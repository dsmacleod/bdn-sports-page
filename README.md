# bdn-sports-page

A static Maine high school sports page for the Bangor Daily News: scores,
schedules, "follow your team," and latest sports stories, updated
automatically twice a day with no server to run — just a static site fed by
JSON files a scraper writes.

**Live page:** `index.html` (a single-page React app, loaded straight from
CDN scripts — no build step) reads the JSON files in `data/` and renders
everything client-side.

## Design: two official feeds, no site-scraping

This used to also scrape MPA.cc directly for schedules, standings, and
brackets, plus MileSplit for individual athlete results. All of that is gone.
MPA.cc's own page structure and ID numbering keep shifting under us — most
recently, a `TournamentID` we'd hardcoded for Cross Country quietly started
serving Field Hockey's data instead, with no error, just wrong content on the
page. Standings/brackets/athlete stats aren't something this page adds value
by re-hosting anyway; MPA.cc and MileSplit already present that data.

So: **two official feeds, not scrapes**, and standings/brackets are now a
plain link out to MPA.cc's own site instead of a re-hosted (and periodically
wrong) copy of it.

- **MPA official game sync feed**
  (`https://mpa.fpsports.org/services/xmlgamesync.ashx`, `scraper/mpa_feed.py`)
  — a single statewide XML dump of every game: schedule, site, and, once
  played, final score and result per team, plus real status (Postponed /
  Canceled). The only source for `data/schedules.json`
  (`data/mpa_games.json` keeps the same feed unflattened, with the full team
  list for events that have more than two — an invitational, a golf
  tournament fielding a whole conference). The feed ignores query-string
  filtering (confirmed: `?sport=`, `?SportID=`, `?days=`, `?startdate=` all
  return the identical file), so any filtering happens client-side
  (`filter_games()` in `mpa_feed.py`, or the front end's own sport filter).
- **BDN's own Sports category RSS feed**
  (`https://www.bangordailynews.com/category/sports/feed/`, `scraper/featured.py`)
  — every story published in the Sports section, in order. (Not the
  site-wide feed filtered by category tag, which was the original approach —
  on a busy news day, sports stories can get crowded out of that feed
  entirely and never appear no matter how they're tagged. The category feed
  *is* the section: nothing to filter.)

`scraper/config.py`'s `SPORTS` dict is just the sport/gender list now (used to
fill in the gender the feed itself leaves blank for single-gender sports —
Football, Field Hockey — and for the season tabs' `current_season()`).

## Outputs

- `data/schedules.json` — `{last_updated, season, games: [...]}`. Each game:
  `date`, `time`, `type` (League/Tournament), `status` (Normal/Postponed/
  Canceled), `home`, `away`, `site`, `sport`, `gender`, `level`, and, once
  final, `home_score`/`away_score`.
- `data/mpa_games.json` — the same game sync feed, unflattened (a `teams`
  list per event rather than a home/away pair).
- `data/featured.json` — latest Sports-section articles, from BDN's RSS feed
  (title, url, byline, image, pub_date).

## Follow Your Team

The front end lets a reader search for a school and follow it (stored in
`localStorage`, per-browser — nothing server-side). Followed teams get a
"Your Teams" section leading the page: each team's most recent *completed*
result plus their actual next game (a game dated today that hasn't been
played yet counts as "next," not "last" — see `YourTeams` in `app.js`).
Standings/brackets are a link out to MPA.cc rather than pulled in here (see
above).

## Running it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m scraper.main          # fetch everything, write data/*.json
python -m pytest                # run the test suite
python -m http.server 8000      # serve the page locally at :8000
```

`scraper/main.py` runs each source independently and catches errors per
source — one failing (a feed hiccup, a network blip) doesn't stop the other
from writing its file.

## Automation

`.github/workflows/scrape.yml` runs `python -m scraper.main` on a schedule
(7 a.m. and 9 p.m. Eastern) and commits any changed `data/*.json` straight to
`main`. No separate deploy step — GitHub Pages (or wherever `index.html` is
served from) just picks up the new data on the next request.

## Testing

`tests/` mirrors `scraper/` one file per module, using saved XML fixtures in
`tests/fixtures/` rather than hitting the live feeds — so the suite runs
offline and fast (`pytest`, well under a second for the whole suite). When a
feed's format changes, update the matching fixture rather than just patching
the parser blind.

## Known gaps / next

- No division/classification data at all now that standings isn't scraped —
  "Your Teams" and the main feed are purely game-level (who played whom, what
  happened), with a link out to MPA.cc for anything classification/seeding-
  related.
- No individual athlete results (the old MileSplit scrape depended on
  manually-added meet URLs and had nothing in it in practice).
- The MPA game sync feed doesn't carry a division/classification field, so
  there's no way to build one from this data even client-side.
