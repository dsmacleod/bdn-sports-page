"""Parse MPA.cc tournament bracket pages."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup, NavigableString, Tag


def is_tournament_active(html: str) -> bool:
    """Check whether the brackets page has active tournament data.

    The page is considered active when it contains at least one
    ``li.TournamentGame`` element inside the bracket wrapper.

    Returns:
        True if there is at least one bracket game on the page.
    """
    soup = BeautifulSoup(html, "lxml")
    wrapper = soup.find("div", id="TournamentWrapperPanel")
    if not wrapper:
        return False
    game = wrapper.find("li", class_="TournamentGame")
    return game is not None


def _extract_class_name(soup: BeautifulSoup) -> str:
    """Extract class/division name from the page header.

    The ``<h2>`` inside ``div.HeaderText`` has a format like::

        2025-2026 Division A HS - Boys Basketball

    We extract ``"Division A"`` from this text.  If parsing fails,
    fall back to the full text.
    """
    header_div = soup.find("div", class_="HeaderText")
    if not header_div:
        return ""
    h2 = header_div.find("h2")
    if not h2:
        return ""
    text = h2.get_text(strip=True)
    m = re.search(r"(Division\s+\S+)", text)
    if m:
        return m.group(1)
    return text


def _parse_game(game_li: Tag) -> dict:
    """Parse a single ``li.TournamentGame`` into a matchup dict.

    Returns a dict with keys: team1, team2, seed1, seed2, score1,
    score2, header (date/time/venue text).
    """
    teams_div = game_li.find("div", class_="teams")
    if not teams_div:
        return {}

    ranks = teams_div.find_all("span", class_="rank")
    scores = teams_div.find_all("div", class_="scoreright")

    # Extract team names by walking siblings after each <span class="rank">.
    # The structure is: <span.rank>, <img>, then team name as either
    # a bare text node or a <b> element, followed by <div.scoreright>.
    team_names: list[str] = []
    for rank_span in ranks:
        name_parts: list[str] = []
        sibling = rank_span.next_sibling
        while sibling:
            if isinstance(sibling, Tag):
                if sibling.name == "div" and "scoreright" in (
                    sibling.get("class") or []
                ):
                    break
                if sibling.name == "br":
                    break
                if sibling.name == "span" and "rank" in (
                    sibling.get("class") or []
                ):
                    break
                if sibling.name == "b":
                    name_parts.append(sibling.get_text(strip=True))
                # skip <img> and other tags
            elif isinstance(sibling, NavigableString):
                t = str(sibling).strip()
                if t:
                    name_parts.append(t)
            sibling = sibling.next_sibling
        team_names.append(" ".join(name_parts))

    header_div = game_li.find("div", class_="headerLeft")
    header_text = header_div.get_text(strip=True) if header_div else ""

    return {
        "team1": team_names[0] if len(team_names) > 0 else "",
        "team2": team_names[1] if len(team_names) > 1 else "",
        "seed1": ranks[0].get_text(strip=True) if len(ranks) > 0 else "",
        "seed2": ranks[1].get_text(strip=True) if len(ranks) > 1 else "",
        "score1": scores[0].get_text(strip=True) if len(scores) > 0 else "",
        "score2": scores[1].get_text(strip=True) if len(scores) > 1 else "",
        "header": header_text,
    }


def _parse_rounds(soup: BeautifulSoup) -> list[dict]:
    """Parse all rounds from the bracket page.

    Collects games from the qualifying round (``div.qualifyRound``)
    and from the main tournament rounds (``div.tournament > ul.round``).

    Returns a list of round dicts::

        [
          {
            "class_name": "Preliminary Round",
            "matchups": [ ... ]
          },
          {
            "class_name": "Quarterfinal",
            "matchups": [ ... ]
          },
          ...
        ]
    """
    rounds: list[dict] = []

    # Qualifying / preliminary round
    qualify_div = soup.find("div", class_="qualifyRound")
    if qualify_div:
        header = qualify_div.find("div", class_="roundHeader")
        round_name = header.get_text(strip=True) if header else "Preliminary Round"
        games = qualify_div.find_all("li", class_="TournamentGame")
        matchups = [_parse_game(g) for g in games if _parse_game(g)]
        if matchups:
            rounds.append({"class_name": round_name, "matchups": matchups})

    # Main tournament rounds
    tournament_div = soup.find("div", class_="tournament")
    if tournament_div:
        for round_ul in tournament_div.find_all("ul", class_="round"):
            header_li = round_ul.find("li", class_="roundHeader")
            round_name = (
                header_li.get_text(strip=True) if header_li else "Round"
            )
            games = round_ul.find_all("li", class_="TournamentGame")
            matchups = [_parse_game(g) for g in games if _parse_game(g)]
            if matchups:
                rounds.append({"class_name": round_name, "matchups": matchups})

    return rounds


def parse_brackets(html: str) -> list[dict]:
    """Parse TournamentCentralBrackets.aspx HTML into bracket data.

    Returns a list of round dicts, each containing a ``class_name``
    (round name) and a list of ``matchups``::

        [
          {
            "class_name": "Quarterfinal",
            "matchups": [
              {
                "team1": "Camden Hills Regional",
                "team2": "Skowhegan Area",
                "seed1": "1",
                "seed2": "8",
                "score1": "69",
                "score2": "44",
                "header": "SAT 2/14, 8:30 PM @Augusta Civic Center"
              },
              ...
            ]
          }
        ]

    Returns an empty list if no bracket data is found.
    """
    soup = BeautifulSoup(html, "lxml")
    return _parse_rounds(soup)


def fetch_brackets(
    session,
    base_url: str,
    tournament_id: int | None = None,
) -> dict:
    """Fetch bracket data from MPA.

    Args:
        session: A ``requests.Session`` (or compatible) with headers set.
        base_url: The MPA base URL, e.g. ``https://www.mpa.cc``.
        tournament_id: Optional TournamentID query parameter.

    Returns:
        Dict with keys:
            tournament_active -- bool indicating whether brackets exist
            class_name        -- division/class name from the page header
            brackets          -- list of round dicts from ``parse_brackets``
    """
    url = f"{base_url}/TournamentCentralBrackets.aspx"
    if tournament_id is not None:
        url += f"?TournamentID={tournament_id}"

    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    html = resp.text

    active = is_tournament_active(html)
    brackets = parse_brackets(html) if active else []

    soup = BeautifulSoup(html, "lxml")
    class_name = _extract_class_name(soup)

    return {
        "tournament_active": active,
        "class_name": class_name,
        "brackets": brackets,
    }
