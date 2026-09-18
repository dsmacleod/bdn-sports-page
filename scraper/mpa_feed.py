"""Parse the Maine Principals' Association game sync feed.

Source: https://mpa.fpsports.org/services/xmlgamesync.ashx

This is a separate, official feed from the MPA.cc site scraped elsewhere in
this package (schedules.py, standings.py) — it's a single XML document
covering every sport/school statewide, no query-string filtering (confirmed:
?sport=, ?SportID=, ?days=, ?startdate= all return the identical file, so any
filtering has to happen client-side, see filter_games()). Compared to the
MPA.cc schedule scrape, it additionally carries final scores/results per team
and event status (Normal / Postponed / Canceled), not just the schedule.

Each <Event> can have two teams (a dual meet/game) or several (an invitational,
a golf tournament fielding whole conferences, etc.) — team-related fields are
kept as a list rather than assumed to be exactly two.
"""

from __future__ import annotations

import re

from lxml import etree

# "Cross Country (Boys)" -> ("Cross Country", "Boys"); "Football" (no gender
# suffix in this feed) -> ("Football", "").
_SPORT_GENDER_RE = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*$")


def _split_sport(raw: str) -> tuple[str, str]:
    m = _SPORT_GENDER_RE.match(raw.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw.strip(), ""


def _text(el, tag: str) -> str:
    child = el.find(tag)
    if child is None or child.text is None:
        return ""
    return child.text.strip()


def parse_gamesync(xml_text: str) -> list[dict]:
    """Parse the xmlgamesync.ashx response into a list of event dicts.

    Each dict:
        game_id -- MPA's GameID, as a string
        date    -- YYYY-MM-DD, as given (the feed already uses this format)
        time    -- e.g. "4:00 PM", or "Postponed"/"Canceled" for those statuses
        sport   -- e.g. "Cross Country" (gender suffix split out separately)
        gender  -- "Boys" / "Girls" / "Coed", or "" if the feed didn't say
        level   -- e.g. "Varsity"
        type    -- "League" or "Tournament"
        status  -- "Normal" / "Postponed" / "Canceled"
        site    -- venue name
        teams   -- list of {school, home_away, result, score}; score is an
                   int when present, else None. Two-team events also get
                   convenience "home"/"away" (school names) and, once final,
                   "home_score"/"away_score" ints.
    """
    root = etree.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    events: list[dict] = []

    for event_el in root.findall("Event"):
        sport, gender = _split_sport(_text(event_el, "Sport"))

        teams: list[dict] = []
        for team_el in event_el.findall("Team"):
            score_text = _text(team_el, "Score")
            teams.append({
                "school": _text(team_el, "School"),
                "home_away": _text(team_el, "HomeAway"),
                "result": _text(team_el, "Result"),
                "score": int(score_text) if score_text.isdigit() else None,
            })

        game = {
            "game_id": event_el.get("GameID", ""),
            "date": _text(event_el, "GameDate"),
            "time": _text(event_el, "Time"),
            "sport": sport,
            "gender": gender,
            "level": _text(event_el, "TeamLevel"),
            "type": _text(event_el, "Type"),
            "status": _text(event_el, "Status"),
            "site": _text(event_el, "Site"),
            "teams": teams,
        }

        if len(teams) == 2:
            home = next((t for t in teams if t["home_away"] == "Home"), teams[0])
            away = next((t for t in teams if t["home_away"] == "Away"), teams[1])
            game["home"] = home["school"]
            game["away"] = away["school"]
            if home["score"] is not None and away["score"] is not None:
                game["home_score"] = home["score"]
                game["away_score"] = away["score"]

        events.append(game)

    return events


def filter_games(
    games: list[dict],
    sport: str | None = None,
    since: str | None = None,
    school: str | None = None,
) -> list[dict]:
    """Client-side filtering — the feed itself ignores query-string filters.

    sport:  exact match against the "sport" field (case-insensitive)
    since:  keep games with date >= since (YYYY-MM-DD, string-comparable)
    school: keep games where any team's school contains this substring
            (case-insensitive)
    """
    out = games
    if sport:
        out = [g for g in out if g["sport"].lower() == sport.lower()]
    if since:
        out = [g for g in out if g["date"] >= since]
    if school:
        needle = school.lower()
        out = [g for g in out if any(needle in t["school"].lower() for t in g["teams"])]
    return out


def fetch_gamesync(session, url: str) -> list[dict]:
    """Fetch and parse the live feed."""
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return parse_gamesync(resp.text)


# The feed only puts a gender in parens when a sport has separate boys'/girls'
# competitions (e.g. "Soccer (Boys)"); single-gender sports come through with
# no suffix at all ("Football", "Field Hockey" in the current fall feed). The
# front end's sport filter labels a game "Sport (Gender)" whenever gender is
# set and non-Coed, so a blank gender here would produce a second, unmatched
# "Football" option alongside standings' "Football (Boys)" (standings still
# comes from the MPA.cc scrape's config.SPORTS, which does say Boys). Fall
# back to config.SPORTS for exactly the sports that are single-gender there
# (i.e. unambiguous — Cross Country etc. have both a Boys and a Girls entry,
# so they're excluded and left to the feed's own (Boys)/(Girls) suffix).
def _build_gender_fallback() -> dict[str, str]:
    from collections import defaultdict

    from .config import SPORTS

    genders_by_sport: dict[str, set[str]] = defaultdict(set)
    for season_sports in SPORTS.values():
        for cfg in season_sports:
            genders_by_sport[cfg["sport"]].add(cfg["gender"])
    return {sport: next(iter(genders)) for sport, genders in genders_by_sport.items() if len(genders) == 1}


_GENDER_FALLBACK = _build_gender_fallback()


def to_schedule_game(event: dict) -> dict:
    """Flatten one parsed gamesync event into the flat schedule-list shape
    the front end reads (schedules.json's "games" list): date/time/type/
    home/away/site/sport/gender, plus status/level/game_id and, once final,
    home_score/away_score — everything the old MPA.cc schedule scrape
    produced, plus the score/status data it didn't have.

    Events with more than two teams (a golf tournament fielding whole
    conferences, an invitational) don't have a real home/away pair: whichever
    team (if any) is marked Home becomes "home", and every other participant
    is comma-joined into "away" — matching how the old MPA.cc scrape already
    flattened these multi-team entries.
    """
    teams = event["teams"]
    home_team = next((t for t in teams if t["home_away"] == "Home"), None)
    others = [t for t in teams if t is not home_team]

    gender = event["gender"] or _GENDER_FALLBACK.get(event["sport"], "")

    game = {
        "game_id": event["game_id"],
        "date": event["date"],
        "time": event["time"],
        "type": event["type"],
        "status": event["status"],
        "level": event["level"],
        "home": home_team["school"] if home_team else "",
        "away": ", ".join(t["school"] for t in others),
        "site": event["site"],
        "sport": event["sport"],
        "gender": gender,
    }
    if home_team is not None and home_team["score"] is not None:
        game["home_score"] = home_team["score"]
    if len(others) == 1 and others[0]["score"] is not None:
        game["away_score"] = others[0]["score"]
    return game


def to_schedule_games(events: list[dict]) -> list[dict]:
    return [to_schedule_game(e) for e in events]
