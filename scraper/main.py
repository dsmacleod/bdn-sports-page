"""Main scraper orchestrator -- run by GitHub Action."""

import json
import os
from datetime import datetime, timezone

import requests

from scraper.config import MPA_BASE, MPA_GAMESYNC_URL, MILESPLIT_MEETS, SPORTS, current_season
from scraper.standings import fetch_standings
from scraper.brackets import fetch_brackets
from scraper.featured import fetch_featured
from scraper.athletes import fetch_athletes
from scraper.mpa_feed import fetch_gamesync, to_schedule_games

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def run():
    """Run all scrapers and write JSON files."""
    now = datetime.now(timezone.utc)
    season = current_season(now.month)
    print("BDN Sports Scraper -- %s season" % season)

    session = requests.Session()
    session.headers["User-Agent"] = "BDNSportsScraper/1.0 (bangordailynews.com)"

    sport_list = SPORTS[season]
    tournament_ids = [s["tournament_id"] for s in sport_list]

    # Fetch the MPA official game sync feed once, up front -- both schedules
    # (below) and the raw mpa_games.json dump (step 6) come from it, and it's
    # a ~1.4MB statewide file, not worth pulling twice.
    print("Fetching MPA game sync feed...")
    gamesync_events = None
    try:
        gamesync_events = fetch_gamesync(session, MPA_GAMESYNC_URL)
    except Exception as e:
        print("  ERROR fetching MPA game sync feed: %s" % e)

    # 1. Schedules -- from the feed above, not the MPA.cc scrape anymore: the
    # feed has everything the scrape did plus final scores and real status
    # (Postponed/Canceled), which the scrape never exposed. It's a single
    # statewide dump covering every sport at once, so it isn't filtered to
    # sport_list here -- that would just drop data the front end can already
    # filter by sport itself.
    print("1. Building schedules from the game sync feed...")
    if gamesync_events is not None:
        schedule_data = to_schedule_games(gamesync_events)
        _write_json("schedules.json", {
            "last_updated": now.isoformat(),
            "season": season,
            "games": schedule_data,
        })
    else:
        print("  Skipped -- game sync feed unavailable.")

    # 2. Standings
    print("2. Fetching standings...")
    try:
        standings_data = fetch_standings(session, MPA_BASE, tournament_ids)
        standings_output = []
        for tid, divisions in standings_data.items():
            sport_info = next(
                (s for s in sport_list if s["tournament_id"] == tid), {}
            )
            standings_output.append({
                "sport": sport_info.get("sport", "Unknown"),
                "gender": sport_info.get("gender", ""),
                "tournament_id": tid,
                "divisions": divisions,
            })
        _write_json("standings.json", {
            "last_updated": now.isoformat(),
            "season": season,
            "sports": standings_output,
        })
    except Exception as e:
        print("  ERROR fetching standings: %s" % e)

    # 3. Brackets (fetch per tournament since fetch_brackets takes a single ID)
    print("3. Fetching brackets...")
    try:
        all_brackets = []
        for sport in sport_list:
            tid = sport["tournament_id"]
            bracket_data = fetch_brackets(session, MPA_BASE, tournament_id=tid)
            all_brackets.append({
                "sport": sport["sport"],
                "gender": sport["gender"],
                "tournament_id": tid,
                **bracket_data,
            })
        _write_json("brackets.json", {
            "last_updated": now.isoformat(),
            "season": season,
            "sports": all_brackets,
        })
    except Exception as e:
        print("  ERROR fetching brackets: %s" % e)

    # 4. Featured articles
    print("4. Fetching featured articles...")
    try:
        articles = fetch_featured(session)
        _write_json("featured.json", {
            "last_updated": now.isoformat(),
            "articles": articles,
        })
    except Exception as e:
        print("  ERROR fetching featured: %s" % e)

    # 5. Athlete results (MileSplit meet pages)
    if MILESPLIT_MEETS:
        print("5. Fetching athlete results...")
        try:
            athletes_data = fetch_athletes(session, MILESPLIT_MEETS)
            _write_json("athletes.json", {
                "last_updated": now.isoformat(),
                "season": season,
                "athletes": athletes_data,
            })
        except Exception as e:
            print("  ERROR fetching athletes: %s" % e)
    else:
        print("5. No MileSplit meet URLs configured, skipping athletes.")

    # 6. Raw MPA game sync feed, unflattened -- keeps the full team list per
    # event (schedules.json's home/away flattening loses anything past two
    # teams), for anything later that wants a real invitational/meet's full
    # field rather than just a home/away pair.
    print("6. Writing raw MPA game sync feed...")
    if gamesync_events is not None:
        _write_json("mpa_games.json", {
            "last_updated": now.isoformat(),
            "games": gamesync_events,
        })
    else:
        print("  Skipped -- game sync feed unavailable.")

    print("Done.")


def _write_json(filename, data):
    """Write JSON file to data/ dir."""
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("  Wrote %s" % path)


if __name__ == "__main__":
    run()
