# bdn-sports-page

A static Maine high school sports page for the Bangor Daily News: scores,
schedules, standings, brackets, and featured stories, updated automatically
twice a day with no server to run — just a static site fed by JSON files a
scraper writes.

**Live page:** `index.html` (a single-page React app, loaded straight from
CDN scripts — no build step) reads the JSON files in `data/` and renders
everything client-side.

## Inputs

Three separate data sources feed `data/*.json`, each with different strengths
— see `scraper/main.py` for how they're combined:

- **MPA official game sync feed**
  (`https://mpa.fpsports.org/services/xmlgamesync.ashx`, `scraper/mpa_feed.py`)
  — a single statewide XML dump of every game: schedule, site, and, once
  played, final score and result per team, plus real status (Postponed /
  Canceled). This is now the **only** source for `data/schedules.json`
  (`data/mpa_games.json` keeps the same feed unflattened, with the full team
  list for events that have more than two — an invitational, a golf
  tournament fielding a whole conference). The feed ignores query-string
  filtering (confirmed: `?sport=`, `?SportID=`, `?days=`, `?startdate=` all
  return the identical file), so any filtering happens client-side
  (`filter_games()` in `mpa_feed.py`, or the front end's own sport filter).
- **MPA.cc** (`scraper/standings.py`, `scraper/brackets.py`) — scraped for
  standings and tournament brackets specifically, because those pages carry
  two things the game sync feed doesn't have at all: MPA's official
  classification/division groupings, and the Tournament Index (MPA's own
  computed power rating used for playoff seeding). Not something we can
  reproduce by just tallying wins and losses from the game feed.
- **BDN's own RSS feed** (`scraper/featured.py`) — sports-tagged articles for
  the "Featured Stories" strip.
- **Maine MileSplit** (`scraper/athletes.py`) — individual track/XC athlete
  results, for meets whose URLs are added to `MILESPLIT_MEETS` in
  `scraper/config.py` (empty by default; there's no feed to poll here, meet
  URLs have to be added by hand as they're posted).

`scraper/config.py`'s `SPORTS` dict maps each MPA.cc tournament/schedule ID
to a sport+gender, split by season (fall/winter/spring); `current_season()`
picks the season from the current month.

## Outputs

- `data/schedules.json` — `{last_updated, season, games: [...]}`. Each game:
  `date`, `time`, `type` (League/Tournament), `status` (Normal/Postponed/
  Canceled), `home`, `away`, `site`, `sport`, `gender`, `level`, and, once
  final, `home_score`/`away_score`.
- `data/mpa_games.json` — the same game sync feed, unflattened (a `teams`
  list per event rather than a home/away pair).
- `data/standings.json` — per-sport division standings (rank, record,
  Tournament Index, qualifying status), from MPA.cc.
- `data/brackets.json` — tournament bracket state, from MPA.cc.
- `data/featured.json` — featured sports articles, from BDN's RSS feed.
- `data/athletes.json` — individual athlete results, from MileSplit (only
  written if `MILESPLIT_MEETS` has entries).

## Running it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m scraper.main          # fetch everything, write data/*.json
python -m pytest                # run the test suite
python -m http.server 8000      # serve the page locally at :8000
```

`scraper/main.py` runs every source independently and catches errors per
source — one source failing (a schedule format change, a network blip)
doesn't stop the others from writing their files.

## Automation

`.github/workflows/scrape.yml` runs `python -m scraper.main` on a schedule
(7 a.m. and 9 p.m. Eastern) and commits any changed `data/*.json` straight to
`main`. No separate deploy step — GitHub Pages (or wherever `index.html` is
served from) just picks up the new data on the next request.

## Testing

`tests/` mirrors `scraper/` one file per module, using saved HTML/XML
fixtures in `tests/fixtures/` rather than hitting the live sites — so the
suite runs offline and fast (`pytest`, ~1s for the whole suite). When a
source's page/feed format changes, update the matching fixture rather than
just patching the parser blind.

## Known gaps / next

- Standings/brackets still depend on MPA.cc's own HTML, which is one layout
  change away from breaking (unlike the game sync feed, which is a stable
  official API). Worth watching for that class of failure specifically, since
  it fails quietly (`main.py` catches the exception and moves on — check the
  Action's logs, not just whether the site is empty).
- `MILESPLIT_MEETS` is empty by default and has to be populated by hand per
  meet; there's no MileSplit feed to poll automatically.
- The MPA game sync feed doesn't carry a division/classification field, so
  there's no way to filter/join it against standings' division groupings
  beyond matching school names.
