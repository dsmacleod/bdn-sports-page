"""Main scraper orchestrator -- run by GitHub Action.

Two sources, both official feeds -- no site-scraping anymore (see
config.py's docstring for why standings/brackets/athletes were dropped):
  - MPA's game sync feed -> schedules.json (scores/schedule) + mpa_games.json
    (the same feed, unflattened).
  - BDN's own Sports category RSS feed -> featured.json (Latest Stories).
"""

import json
import os
from datetime import datetime, timezone

import requests

from scraper.config import MPA_GAMESYNC_URL, current_season
from scraper.featured import fetch_featured
from scraper.mpa_feed import fetch_gamesync, to_schedule_games

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def run():
    """Run all scrapers and write JSON files."""
    now = datetime.now(timezone.utc)
    season = current_season(now.month)
    print("BDN Sports Scraper -- %s season" % season)

    session = requests.Session()
    session.headers["User-Agent"] = "BDNSportsScraper/1.0 (bangordailynews.com)"

    # Fetch the MPA official game sync feed once, up front -- both schedules
    # (below) and the raw mpa_games.json dump come from it, and it's a
    # ~1.4MB statewide file, not worth pulling twice.
    print("Fetching MPA game sync feed...")
    gamesync_events = None
    try:
        gamesync_events = fetch_gamesync(session, MPA_GAMESYNC_URL)
    except Exception as e:
        print("  ERROR fetching MPA game sync feed: %s" % e)

    # 1. Schedules
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

    # 2. Latest Stories (BDN's own Sports section)
    print("2. Fetching latest sports stories...")
    try:
        articles = fetch_featured(session)
        _write_json("featured.json", {
            "last_updated": now.isoformat(),
            "articles": articles,
        })
    except Exception as e:
        print("  ERROR fetching featured: %s" % e)

    # 3. Raw MPA game sync feed, unflattened -- keeps the full team list per
    # event (schedules.json's home/away flattening loses anything past two
    # teams), for anything later that wants a real invitational/meet's full
    # field rather than just a home/away pair.
    print("3. Writing raw MPA game sync feed...")
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
