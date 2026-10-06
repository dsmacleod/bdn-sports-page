# bdn-sports-page

A static Maine high school sports page for the Bangor Daily News: scores,
schedules, "pin your school," and latest sports stories, updated
automatically twice a day with no server to run — just a static site fed by
JSON files a scraper writes.

**Live page:** `index.html` (a single-page React app, loaded straight from
CDN scripts — no build step) reads the JSON files in `data/` and renders
everything client-side. Because it's client-rendered, an agent/crawler that
only reads the served HTML sees an empty `<div id="root">` — **[llms.txt](llms.txt)**
documents the underlying `data/*.json` files directly (schema, examples, what's
deliberately not included) for anything that wants the data without a browser.

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

## Pin Your School

The front end lets a reader search for a school and pin it (stored in
`localStorage`, per-browser — nothing server-side, and no alerts of any kind).
The reader-facing wording is deliberately "pin," not "follow": "follow"
promises notifications this static page can't send. (The code still calls it
"followed teams," and the storage key is unchanged so existing pins survive.)
Pinned schools get a "Your Schools" section leading the page: each team's most recent *completed*
result plus their actual next game (a game dated today that hasn't been
played yet counts as "next," not "last" — see `YourTeams` in `app.js`).
Standings/brackets are a link out to MPA.cc rather than pulled in here (see
above).

## Embedding it on another page

It runs on BDN's scores page,
<https://www.bangordailynews.com/maine-sports/maine-high-school-sports-scores/>,
from GitHub Pages (`dsmacleod.github.io/bdn-sports-page/`). The files can't
live under `bangordailynews.com/maine-sports/` itself: WordPress owns that
path. To put it on that page (or any other), use a WordPress **Custom HTML** block:

```html
<div data-bdn-sports-embed></div>
<script src="https://dsmacleod.github.io/bdn-sports-page/embed.js" async></script>
```

`embed.js` puts in an iframe of `index.html?embed=1` from its own directory
and keeps the iframe as tall as its content, so the host page scrolls
normally and there's no inner scrollbar. It's an iframe, not inlined markup,
on purpose: the Tailwind CDN script injects global CSS that would restyle the
whole host page. Add `data-stories="1"` to the div to keep Latest Stories,
which embed mode drops by default because the Sports section is already the
story list.

Embed mode (`?embed=1`, and only when actually framed) also:
- reports its height to the host via `postMessage`, and asks the host to
  scroll for the ticker's "All N →" jump (the iframe itself never scrolls);
- opens the game popup next to the click instead of centered in the
  iframe, which on a tall iframe can be off-screen;
- opens BDN story links in the same tab (`target="_top"`), not a new one.
- takes on the host page's look instead of its own (`html.embed` styles in
  `index.html`): no green title bar (the page's headline is the title), a
  light scores strip instead of the black one, white background flush with
  the text column, Helvetica bold headings, and BDN's dark-green uppercase
  section labels between rules. The popup doesn't dim, since a dimmed
  rectangle would show the iframe's edges.

For more room, set the WordPress Columns block holding the embed to **Wide
width** (the scores page's theme supports it; about 1,030px on a 1280px
screen instead of the 780px text column).

Nothing in the page may use viewport height (`100vh`, `min-h-screen`) in embed
mode: the viewport *is* the iframe, so an auto-sized iframe would only grow.

If WordPress strips the `<script>` (only roles with `unfiltered_html` can
save one), a bare iframe works, just at a fixed height with its own
scrollbar:

```html
<iframe src="https://dsmacleod.github.io/bdn-sports-page/index.html?embed=1"
        style="width:100%;height:1200px;border:0" title="Maine high school sports scores"></iframe>
```

Pinned schools and the cross-site iframe: github.io is a different site from
bangordailynews.com, so browsers treat the iframe's `localStorage` as
third-party. Chrome and Firefox keep it (partitioned per host site, so pins
made on the scores page stay on the scores page); Safari may clear it. Pointing
a bangordailynews.com subdomain at GitHub Pages (a CNAME plus the repo's
Pages custom-domain setting) would make it same-site and fix that.

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

GitHub Actions (`.github/workflows/scrape.yml`) runs `python -m scraper.main`
on a schedule (cron 7 a.m. and 9 p.m. Eastern; GitHub often starts scheduled
runs hours late) and commits any changed `data/*.json` straight to `main`.
GitHub Pages serves `main` as-is, so each data commit redeploys the page; no
separate deploy step. "Run workflow" on the Actions tab runs it by hand.

**Scores are not live.** They're only as fresh as the last run, and the page
itself loads the data once per visit. The front end says so: it shows
"Scores as of <time>" from the data's own `last_updated`, and a game with no
score shows its scheduled time (or "No score reported" once its date has
passed), never an in-progress label it can't back up.

`scripts/update-data.sh` does the same refresh (scrape, commit if changed,
push) from any machine with a clone and push access, e.g. from cron; the
crontab line is in its header comment.

## Testing

`tests/` mirrors `scraper/` one file per module, using saved XML fixtures in
`tests/fixtures/` rather than hitting the live feeds — so the suite runs
offline and fast (`pytest`, well under a second for the whole suite). When a
feed's format changes, update the matching fixture rather than just patching
the parser blind.

## Known gaps / next

- No division/classification data at all now that standings isn't scraped —
  "Your Schools" and the main feed are purely game-level (who played whom, what
  happened), with a link out to MPA.cc for anything classification/seeding-
  related.
- No individual athlete results (the old MileSplit scrape depended on
  manually-added meet URLs and had nothing in it in practice).
- The MPA game sync feed doesn't carry a division/classification field, so
  there's no way to build one from this data even client-side.
