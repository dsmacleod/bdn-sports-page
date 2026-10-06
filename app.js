/* ===================================================================
   Maine High School Sports — Bangor Daily News
   Complete React SPA
   =================================================================== */

const { useState, useEffect, useMemo, useRef } = React;

// ---------------------------------------------------------------------------
// Embed mode (?embed=1): the page running inside an iframe that embed.js put
// on another page (the BDN Sports section). The iframe is sized to fit its
// content, so nothing here may depend on the viewport height (that *is* the
// iframe height); this page reports its height and asks for scrolls through
// postMessage instead. ?stories=1 keeps Latest Stories, which is otherwise
// dropped in embed mode because the host page is already the story list.
// ---------------------------------------------------------------------------

const PARAMS = new URLSearchParams(window.location.search);
const EMBED = PARAMS.get('embed') === '1' && window.parent !== window;
const EMBED_STORIES = PARAMS.get('stories') === '1';
// Embed mode also takes on the host page's look (index.html's html.embed
// styles): no title bar, white background, BDN's own heading and section-label
// styles, so it reads as part of the page rather than a box dropped into it.
if (EMBED) document.documentElement.classList.add('embed');

function postToHost(msg) {
  if (EMBED) window.parent.postMessage({ source: 'bdn-sports', ...msg }, '*');
}

// Scroll an element into view: in embed mode the host page has to do it,
// since the iframe itself never scrolls.
function scrollToElement(el) {
  if (!el) return;
  if (EMBED) postToHost({ type: 'scroll', top: el.getBoundingClientRect().top + window.scrollY });
  else el.scrollIntoView({ behavior: 'smooth' });
}

// Where the reader last clicked, in document coordinates: embed mode puts
// the game popup there, since the middle of a tall iframe may be off-screen.
let lastPointerY = 0;
document.addEventListener('pointerdown', e => { lastPointerY = e.pageY; }, true);

// Links to bangordailynews.com stories: same tab on the embed's host page
// (it's the same site), new tab when this page stands alone.
const STORY_LINK_TARGET = EMBED ? { target: '_top' } : { target: '_blank', rel: 'noopener noreferrer' };

function useReportHeight() {
  useEffect(() => {
    if (!EMBED) return;
    let last = 0;
    const report = () => {
      const h = document.documentElement.scrollHeight;
      if (h !== last) { last = h; postToHost({ type: 'height', height: h }); }
    };
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    report();
    return () => ro.disconnect();
  }, []);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// AP-style month abbreviations, matching the rest of bangordailynews.com.
const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function todayStr() {
  return toDateStr(new Date());
}

function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/** "Sept. 19" */
function apDate(dateStr) {
  const d = parseDate(dateStr);
  return `${AP_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Today" / "Yesterday" / "Tomorrow" / "Saturday" (within a week) / "Sept. 3". */
function relativeDay(dateStr, today = todayStr()) {
  const diff = daysBetween(today, dateStr);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (Math.abs(diff) < 7) return WEEKDAYS[parseDate(dateStr).getDay()];
  return apDate(dateStr);
}

/** "Saturday, Sept. 19" */
function longDate(dateStr) {
  return `${WEEKDAYS[parseDate(dateStr).getDay()]}, ${apDate(dateStr)}`;
}

/** "5h ago", "Yesterday", "3 days ago". Takes a full timestamp. */
function timeAgo(iso) {
  const hours = hoursSince(iso);
  if (hours < 1) return 'Just in';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function hoursSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

/** "4:00 PM" -> minutes since midnight, or null for blank/unparseable. */
function parseTime(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// Football and field hockey are single-gender in Maine, so "Boys Football"
// would just be noise. Everything else reads "Girls Soccer", "Boys Soccer".
const SINGLE_GENDER_SPORTS = ['Football', 'Field Hockey'];

function sportLabel(game) {
  if (!game.gender || game.gender === 'Coed' || SINGLE_GENDER_SPORTS.includes(game.sport)) return game.sport;
  return `${game.gender} ${game.sport}`;
}

// Short tags for the scores ticker, where space is tight.
const SPORT_ABBREV = {
  'Soccer': 'SOC', 'Field Hockey': 'FH', 'Football': 'FB', 'Volleyball': 'VB',
  'Golf': 'GOLF', 'Cross Country': 'XC', 'Basketball': 'BKB', 'Ice Hockey': 'HOC',
  'Baseball': 'BSB', 'Softball': 'SB', 'Lacrosse': 'LAX', 'Tennis': 'TEN',
};

function sportAbbrev(game) {
  const base = SPORT_ABBREV[game.sport] || game.sport.slice(0, 4).toUpperCase();
  if (!game.gender || game.gender === 'Coed' || SINGLE_GENDER_SPORTS.includes(game.sport)) return base;
  return `${game.gender[0]} ${base}`;
}

function isMultiTeam(game) {
  return (game.away || '').includes(',');
}

function awayTeams(game) {
  return (game.away || '').split(',').map(s => s.trim()).filter(Boolean);
}

/** The state that decides how a game is drawn. Only claims what the data
    actually says -- the scores are a twice-daily snapshot, not a live feed,
    so there's no "in progress" state: a start time passing tells us nothing
    about whether a game is being played, over, or delayed.
    final     -- has a score
    ppd / cxl -- postponed / canceled per the feed
    noscore   -- its date has passed and the feed has no score for it. Must
                 NOT read as "Final".
    scheduled -- today or later, no score in the feed (yet) */
function gameState(game, today = todayStr()) {
  if (game.status === 'Postponed' || (!game.status && (game.time || '').toLowerCase().includes('postponed'))) return 'ppd';
  if (game.status === 'Canceled') return 'cxl';
  if (game.home_score !== undefined) return 'final';
  if (game.date < today) return 'noscore';
  return 'scheduled';
}

// Golf mixes stroke totals (low wins) with match points (high wins) in the
// same feed, and cross country is low-score-wins across whole fields, so we
// only call a winner where higher score unambiguously wins.
const NO_WINNER_SPORTS = ['Golf', 'Cross Country'];

function winner(game) {
  if (game.home_score === undefined || game.away_score === undefined || game.away_score === null) return null;
  if (NO_WINNER_SPORTS.includes(game.sport) || isMultiTeam(game)) return null;
  if (game.home_score > game.away_score) return 'home';
  if (game.away_score > game.home_score) return 'away';
  return 'tie';
}

/** All school names that appear anywhere in the schedule (home, or any
    comma-joined away participant), for the pin-a-school search. */
function allSchoolNames(games) {
  const set = new Set();
  (games || []).forEach(g => {
    if (g.home) set.add(g.home);
    awayTeams(g).forEach(name => set.add(name));
  });
  return Array.from(set).sort();
}

/** Does this game involve the given school, as home or anywhere in the
    (possibly multi-team) away list? */
function gameInvolves(game, teamName) {
  const needle = teamName.toLowerCase();
  if ((game.home || '').toLowerCase() === needle) return true;
  return awayTeams(game).some(n => n.toLowerCase() === needle);
}

// Re-render on an interval so relative times ("2h ago") stay accurate on a page left open, without a reload.
function useTick(ms) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

// The data is refreshed twice a day (7 a.m./9 p.m.), so the longest normal
// gap is 14h. Past that a run was missed, and the "as of" badge turns amber.
const STALE_AFTER_HOURS = 15;

function Header({ lastUpdated }) {
  useTick(30000);
  // Embedded, the host page's own headline is the title; the "as of" time
  // moves to the scoreboard's note.
  if (EMBED) return null;
  const stale = lastUpdated && hoursSince(lastUpdated) > STALE_AFTER_HOURS;
  const asOf = lastUpdated && new Date(lastUpdated).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  });

  return (
    <header className="bg-bdn-green text-white py-3 px-4">
      <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
        <h1 className="font-heading text-xl md:text-2xl font-extrabold tracking-tight uppercase">
          Maine High School Sports
        </h1>
        {lastUpdated && (
          // An absolute time, not "Updated 2h ago" with a pulsing dot --
          // that reads as live, and these scores aren't.
          <span className={`ml-auto text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${
            stale ? 'bg-bdn-gold text-bdn-gray' : 'bg-white bg-opacity-10'
          }`}>
            Scores as of {asOf}
          </span>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Scores ticker: the most recent night of finals, right under the masthead
// ---------------------------------------------------------------------------

function latestFinalsDate(games, today) {
  let latest = null;
  games.forEach(g => {
    if (g.home_score !== undefined && g.date <= today && (!latest || g.date > latest)) latest = g.date;
  });
  return latest;
}

function ScoresTicker({ games, onGameClick, onSeeAll }) {
  const today = todayStr();
  const date = useMemo(() => latestFinalsDate(games, today), [games, today]);
  const finals = useMemo(() => {
    if (!date) return [];
    // Decided head-to-head games first -- they're the ones a score line
    // actually communicates; multi-team meets are a name list.
    return games
      .filter(g => g.date === date && g.home_score !== undefined)
      .sort((a, b) => (winner(b) ? 1 : 0) - (winner(a) ? 1 : 0) || sportLabel(a).localeCompare(sportLabel(b)));
  }, [games, date]);

  if (!finals.length) return null;

  return (
    <div className="ticker bg-bdn-gray text-white">
      <div className="max-w-6xl mx-auto flex items-stretch">
        <button
          onClick={() => onSeeAll(date)}
          className="flex-shrink-0 flex flex-col justify-center px-4 py-2 border-r border-white border-opacity-20 text-left hover:bg-white hover:bg-opacity-10"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-bdn-gold">Finals</span>
          <span className="text-sm font-bold leading-tight">{relativeDay(date, today)}</span>
          <span className="text-[10px] text-gray-400 whitespace-nowrap">All {finals.length} &rarr;</span>
        </button>
        <div className="flex min-w-0 overflow-x-auto ticker-scroll">
          {finals.map(g => <TickerItem key={g.game_id} game={g} onClick={onGameClick} />)}
        </div>
      </div>
    </div>
  );
}

function TickerItem({ game, onClick }) {
  const w = winner(game);
  const multi = isMultiTeam(game) || game.away_score === undefined || game.away_score === null;
  const row = (name, score, side) => (
    <div className={`flex justify-between gap-3 ${w && w !== side && w !== 'tie' ? 'text-gray-400' : 'text-white font-semibold'}`}>
      <span className="truncate">{name}</span>
      {score !== null && <span className="tabular-nums">{score}</span>}
    </div>
  );
  return (
    <button
      onClick={() => onClick(game)}
      className="flex-shrink-0 w-44 px-3 py-2 border-r border-white border-opacity-10 text-left text-xs hover:bg-white hover:bg-opacity-10"
    >
      <div className="text-[10px] text-gray-400 font-bold tracking-wide mb-0.5">{sportAbbrev(game)}</div>
      {multi ? (
        <>
          {row(game.home, null, 'home')}
          <div className="text-gray-400 truncate">+ {awayTeams(game).length} other{awayTeams(game).length === 1 ? '' : 's'}</div>
        </>
      ) : (
        <>
          {row(game.away, game.away_score, 'away')}
          {row(game.home, game.home_score, 'home')}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Top stories: one lead, a short headline list, then out to the section
// ---------------------------------------------------------------------------

const NEW_STORY_HOURS = 12;
const SPORTS_SECTION_URL = 'https://www.bangordailynews.com/category/sports/';

function TopStories({ articles }) {
  if (!articles || articles.length === 0) return null;
  const [lead, ...rest] = articles;
  const list = rest.slice(0, 5);

  return (
    <section className="max-w-6xl mx-auto px-4 mt-6">
      <SectionHeading>Latest Stories</SectionHeading>
      <div className="grid md:grid-cols-5 gap-5">
        <a href={lead.url || '#'} {...STORY_LINK_TARGET} className="md:col-span-3 group block">
          {lead.image && (
            <img src={lead.image.replace(/&amp;/g, '&')} alt="" className="w-full aspect-[16/9] object-cover rounded" />
          )}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <StoryAge pubDate={lead.pub_date} />
            {lead.byline && <span className="text-gray-500">{lead.byline}</span>}
          </div>
          <h3 className="font-heading text-xl md:text-2xl font-extrabold leading-tight mt-1 group-hover:text-bdn-green">
            {lead.title || 'Untitled'}
          </h3>
        </a>
        <div className="md:col-span-2">
          <ul className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {list.map((a, i) => (
              <li key={i}>
                <a href={a.url || '#'} {...STORY_LINK_TARGET} className="flex gap-3 py-2.5 group">
                  {a.image && <img src={a.image.replace(/&amp;/g, '&')} alt="" className="w-20 h-14 object-cover rounded flex-shrink-0" />}
                  <div className="min-w-0">
                    <StoryAge pubDate={a.pub_date} />
                    <h4 className="text-sm font-bold leading-snug group-hover:text-bdn-green line-clamp-2">{a.title || 'Untitled'}</h4>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          <a href={SPORTS_SECTION_URL} {...STORY_LINK_TARGET} className="inline-block mt-3 text-sm font-bold text-bdn-green hover:underline">
            More sports stories &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}

function StoryAge({ pubDate }) {
  if (!pubDate) return null;
  const isNew = hoursSince(pubDate) < NEW_STORY_HOURS;
  return isNew ? (
    <span className="text-[11px] font-bold uppercase tracking-wide text-red-700">New &middot; {timeAgo(pubDate)}</span>
  ) : (
    <span className="text-[11px] font-semibold text-gray-500">{timeAgo(pubDate)}</span>
  );
}

function SectionHeading({ children, right }) {
  if (EMBED) {
    // BDN's own section label (.article-section-title): small, uppercase,
    // centered between two rules.
    return (
      <div className="mb-3">
        <h2 className="section-label">{children}</h2>
        {right && <div className="flex justify-end mt-2">{right}</div>}
      </div>
    );
  }
  return (
    <div className="flex items-end justify-between border-b-2 border-bdn-gray mb-3 pb-1">
      <h2 className="font-heading text-base font-extrabold uppercase tracking-wide">{children}</h2>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pinned schools ("Your Schools"). Called "following" in the code and the
// storage key, but readers see "pin": it's per-browser and sends no alerts.
// ---------------------------------------------------------------------------

const FOLLOWED_TEAMS_KEY = 'bdn-sports-followed-teams';

function loadFollowedTeams() {
  try {
    const raw = localStorage.getItem(FOLLOWED_TEAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveFollowedTeams(teams) {
  try {
    localStorage.setItem(FOLLOWED_TEAMS_KEY, JSON.stringify(teams));
  } catch (e) {
    // localStorage unavailable (private browsing, etc.) -- following just
    // won't persist across visits, not worth surfacing an error for.
  }
}

function TeamSearch({ allSchools, followed, onFollow, placeholder }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSchools.filter(s => s.toLowerCase().includes(q) && !followed.includes(s)).slice(0, 8);
  }, [query, allSchools, followed]);

  return (
    <div className="relative w-full sm:w-64">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder || 'Search for a school...'}
        aria-label="Pin a school to the top of this page"
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-bdn-gold"
      />
      {matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto">
          {matches.map(s => (
            <button
              key={s}
              onClick={() => { onFollow(s); setQuery(''); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Leads the page once at least one team is followed: each team's most
// recent result plus their next game. With nothing followed it's a slim
// prompt, not a full section.
function YourTeams({ followed, games, allSchools, onFollow, onUnfollow, onGameClick }) {
  const today = todayStr();

  if (followed.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white border border-gray-200 rounded px-4 py-3">
          <p className="text-sm">
            <span className="font-bold">Pin your school to the top.</span>{' '}
            <span className="text-gray-600">Their latest score and next game will show up here whenever you visit on this device.</span>
          </p>
          <div className="sm:ml-auto"><TeamSearch allSchools={allSchools} followed={followed} onFollow={onFollow} /></div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 mt-6">
      <SectionHeading right={<TeamSearch allSchools={allSchools} followed={followed} onFollow={onFollow} placeholder="Pin another school..." />}>
        Your Schools
      </SectionHeading>
      <div className="space-y-4">
        {followed.map(team => {
          // A game dated today isn't "last" until it actually has a score --
          // otherwise a not-yet-played game happening tonight would wrongly
          // show as the most recent result instead of as next up.
          const teamGames = games.filter(g => gameInvolves(g, team));
          const isDone = g => g.home_score !== undefined || g.date < today;
          const last = teamGames.filter(isDone).sort((a, b) => b.date.localeCompare(a.date))[0];
          const next = teamGames.filter(g => !isDone(g))
            .sort((a, b) => a.date.localeCompare(b.date) || (parseTime(a.time) ?? 0) - (parseTime(b.time) ?? 0))[0];
          return (
            <div key={team}>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="font-bold text-sm">{team}</h3>
                <button onClick={() => onUnfollow(team)} className="text-xs text-gray-400 hover:text-red-700" aria-label={`Remove ${team}`}>
                  Remove
                </button>
              </div>
              {!last && !next ? (
                <p className="text-gray-400 text-sm italic">No games found for this team yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {last && <GameCard game={last} onClick={onGameClick} kicker={`Last · ${relativeDay(last.date, today)}`} highlight={team} />}
                  {next && <GameCard game={next} onClick={onGameClick} kicker={`Next · ${relativeDay(next.date, today)}`} highlight={team} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Game card: compact scoreboard box, shared by the scoreboard and Your Schools
// ---------------------------------------------------------------------------

function StateBadge({ state, game }) {
  switch (state) {
    case 'final':
      return <span className="text-[11px] font-extrabold uppercase text-bdn-green">Final</span>;
    case 'ppd':
      return <span className="text-[11px] font-extrabold uppercase text-red-700">Postponed</span>;
    case 'cxl':
      return <span className="text-[11px] font-extrabold uppercase text-gray-500">Canceled</span>;
    case 'noscore':
      return <span className="text-[11px] font-bold uppercase text-gray-500">No score reported</span>;
    default:
      return <span className="text-[11px] font-bold text-bdn-gray">{game.time || 'Time TBA'}</span>;
  }
}

function GameCard({ game, onClick, kicker, showSport, highlight }) {
  const state = gameState(game);
  const w = winner(game);
  const multi = isMultiTeam(game);
  const dim = state === 'ppd' || state === 'cxl';

  const teamRow = (name, score, side) => {
    const lost = w && w !== 'tie' && w !== side;
    const won = w === side;
    const mine = highlight && name.toLowerCase() === highlight.toLowerCase();
    return (
      <div className={`flex justify-between items-baseline gap-2 ${lost ? 'text-gray-500' : ''}`}>
        <span className={`truncate text-sm ${won ? 'font-extrabold' : 'font-semibold'} ${mine ? 'underline decoration-bdn-gold decoration-2 underline-offset-2' : ''}`}>
          {name}
        </span>
        {score !== undefined && score !== null && (
          <span className={`tabular-nums text-base ${won ? 'font-extrabold' : 'font-semibold'}`}>{score}</span>
        )}
      </div>
    );
  };

  return (
    <button
      onClick={() => onClick && onClick(game)}
      className={`w-full text-left bg-white border border-gray-200 rounded px-3 py-2 hover:border-bdn-green transition-colors ${dim ? 'opacity-60' : ''}`}
    >
      <div className="flex justify-between items-center mb-1 gap-2">
        <StateBadge state={state} game={game} />
        <span className="text-[10px] uppercase tracking-wide text-gray-500 truncate">
          {kicker || (showSport ? sportLabel(game) : '')}
        </span>
      </div>
      {multi ? (
        <>
          {teamRow(game.home, undefined, 'home')}
          <div className="text-xs text-gray-500 truncate" title={game.away}>
            + {awayTeams(game).join(', ')}
          </div>
        </>
      ) : (
        <>
          {/* Away over home, the way every scoreboard lists it. */}
          {teamRow(game.away || 'TBD', game.away_score, 'away')}
          {teamRow(game.home || 'TBD', game.home_score, 'home')}
        </>
      )}
      {(kicker || state === 'scheduled') && game.site && (
        <div className="text-[11px] text-gray-400 truncate mt-1">{kicker && state !== 'final' ? `${game.time ? game.time + ' · ' : ''}${game.site}` : game.site}</div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard: pick a day, pick a sport, games grouped by sport
// ---------------------------------------------------------------------------

const DAYS_BACK = 7;
const DAYS_AHEAD = 7;
const GROUP_PREVIEW = 9;

function DayStrip({ games, day, setDay }) {
  const today = todayStr();
  const ref = useRef(null);

  const days = useMemo(() => {
    const counts = {};
    games.forEach(g => {
      const c = counts[g.date] || (counts[g.date] = { total: 0, finals: 0 });
      c.total++;
      if (g.home_score !== undefined) c.finals++;
    });
    const out = [];
    for (let i = -DAYS_BACK; i <= DAYS_AHEAD; i++) {
      const d = addDays(today, i);
      // Always keep today in the strip, even with no games, so readers can
      // orient; other empty days (Sundays, mostly) just drop out.
      if (counts[d] || i === 0) out.push({ date: d, ...(counts[d] || { total: 0, finals: 0 }) });
    }
    return out;
  }, [games, today]);

  // Keep the selected day centered (the strip scrolls sideways on phones).
  // Set scrollLeft directly -- scrollIntoView would also scroll the page
  // itself down to the strip on load. Re-run shortly after, too: the
  // Tailwind CDN script generates styles asynchronously, so on first render
  // the strip may not be a scroll container yet.
  useEffect(() => {
    function center() {
      const strip = ref.current;
      const el = strip && strip.querySelector('[data-selected="true"]');
      if (!el) return;
      const offset = el.getBoundingClientRect().left - strip.getBoundingClientRect().left;
      strip.scrollLeft += offset - (strip.clientWidth - el.offsetWidth) / 2;
    }
    center();
    const id = setTimeout(center, 300);
    return () => clearTimeout(id);
  }, [day]);

  return (
    <div ref={ref} className="flex overflow-x-auto ticker-scroll -mx-1">
      {days.map(d => {
        const selected = d.date === day;
        const isToday = d.date === today;
        const past = d.date < today;
        return (
          <button
            key={d.date}
            data-selected={selected}
            onClick={() => setDay(d.date)}
            className={`flex-shrink-0 mx-1 my-2 px-3 py-1.5 rounded text-center min-w-[5.5rem] border transition-colors ${
              selected
                ? 'bg-bdn-green border-bdn-green text-white'
                : isToday
                  ? 'bg-white border-bdn-gold border-2 text-bdn-gray hover:bg-gray-50'
                  : 'bg-white border-gray-200 text-bdn-gray hover:border-bdn-green'
            }`}
          >
            <div className="text-xs font-extrabold uppercase tracking-wide">{relativeDay(d.date, today)}</div>
            <div className={`text-[11px] ${selected ? 'text-white text-opacity-80' : 'text-gray-500'}`}>
              {past && d.finals ? `${d.finals} final${d.finals === 1 ? '' : 's'}` : `${d.total} game${d.total === 1 ? '' : 's'}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SportChips({ games, value, onChange }) {
  const counts = useMemo(() => {
    const c = {};
    games.forEach(g => { c[g.sport] = (c[g.sport] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [games]);

  const chip = (key, label, n) => (
    <button
      key={key}
      onClick={() => onChange(key)}
      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
        value === key ? 'bg-bdn-gray border-bdn-gray text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-bdn-gray'
      }`}
    >
      {label}{n !== undefined && <span className={`ml-1 font-semibold ${value === key ? 'text-gray-300' : 'text-gray-400'}`}>{n}</span>}
    </button>
  );

  return (
    <div className="flex gap-2 overflow-x-auto ticker-scroll pb-2">
      {chip('', 'All sports', games.length)}
      {counts.map(([sport, n]) => chip(sport, sport, n))}
    </div>
  );
}

// Within a group: finals first (the news), then by start time, with
// postponed/canceled sunk to the bottom.
const STATE_ORDER = { final: 0, noscore: 1, scheduled: 2, ppd: 3, cxl: 4 };

function Scoreboard({ games, day, setDay, sport, setSport, onGameClick, lastUpdated }) {
  const today = todayStr();

  const dayGames = useMemo(() => games.filter(g => g.date === day), [games, day]);
  const shown = useMemo(() => (sport ? dayGames.filter(g => g.sport === sport) : dayGames), [dayGames, sport]);

  const groups = useMemo(() => {
    const byLabel = {};
    shown.forEach(g => { (byLabel[sportLabel(g)] = byLabel[sportLabel(g)] || []).push(g); });
    return Object.entries(byLabel)
      .map(([label, items]) => [label, items.sort((a, b) =>
        STATE_ORDER[gameState(a, today)] - STATE_ORDER[gameState(b, today)] ||
        (parseTime(a.time) ?? 9999) - (parseTime(b.time) ?? 9999) ||
        (a.home || '').localeCompare(b.home || ''))])
      .sort((a, b) => b[1].length - a[1].length);
  }, [shown, today]);

  const tally = useMemo(() => {
    const t = { final: 0, noscore: 0, scheduled: 0, ppd: 0, cxl: 0 };
    shown.forEach(g => { t[gameState(g, today)]++; });
    return t;
  }, [shown, today]);

  const summary = [
    tally.final && `${tally.final} final${tally.final === 1 ? '' : 's'}`,
    tally.noscore && `${tally.noscore} with no score reported`,
    tally.scheduled && `${tally.scheduled} scheduled`,
    tally.ppd && `${tally.ppd} postponed`,
    tally.cxl && `${tally.cxl} canceled`,
  ].filter(Boolean).join(' · ');

  return (
    <section id="scoreboard" className="mt-8 scroll-mt-2">
      {/* Day + sport pickers stay pinned while scrolling a long slate. */}
      {/* Not sticky when embedded: the iframe never scrolls, so it couldn't stick. */}
      <div className={EMBED ? 'border-b border-gray-300' : 'sticky top-0 z-20 bg-gray-50 bg-opacity-95 backdrop-blur border-b border-gray-200'}>
        <div className="max-w-6xl mx-auto px-4">
          <DayStrip games={games} day={day} setDay={setDay} />
          <SportChips games={dayGames} value={sport} onChange={setSport} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="mb-4">
          <h2 className="font-heading text-2xl font-extrabold leading-tight">
            {relativeDay(day, today) === apDate(day) ? longDate(day) : `${relativeDay(day, today)}`}
            {relativeDay(day, today) !== apDate(day) && (
              <span className="text-gray-500 font-semibold text-lg"> &middot; {longDate(day)}</span>
            )}
          </h2>
          {summary && <p className="text-sm text-gray-600 mt-0.5">{summary}</p>}
          <p className={`text-xs mt-1 ${EMBED && lastUpdated && hoursSince(lastUpdated) > STALE_AFTER_HOURS ? 'inline-block bg-bdn-gold text-bdn-gray px-1.5 py-0.5' : 'text-gray-500'}`}>
            Scores aren't live. They're a snapshot of the Maine Principals' Association's results feed
            {lastUpdated && <>, last updated {new Date(lastUpdated).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</>}.
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-gray-500 text-sm italic py-6">No games on this day{sport ? ` for ${sport.toLowerCase()}` : ''}.</p>
        ) : (
          groups.map(([label, items]) => (
            <SportGroup key={`${day}-${label}`} label={label} items={items} onGameClick={onGameClick} />
          ))
        )}
      </div>
    </section>
  );
}

function SportGroup({ label, items, onGameClick }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, GROUP_PREVIEW);
  return (
    <div className="mb-6">
      <h3 className="flex items-baseline gap-2 mb-2">
        <span className="font-heading font-extrabold uppercase tracking-wide text-sm text-bdn-green">{label}</span>
        <span className="text-xs text-gray-400">{items.length}</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map(g => <GameCard key={g.game_id} game={g} onClick={onGameClick} />)}
      </div>
      {items.length > GROUP_PREVIEW && (
        <button onClick={() => setExpanded(e => !e)} className="mt-2 text-sm font-bold text-bdn-green hover:underline">
          {expanded ? 'Show fewer' : `Show all ${items.length} ${label.toLowerCase()} games`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standings & Brackets (link out to MPA.cc instead of re-scraping it -- see
// scraper/config.py's docstring for why)
// ---------------------------------------------------------------------------

function StandingsLinkOut() {
  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <div className="bg-white border border-gray-200 rounded p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-wide mb-1">Standings & Brackets</h2>
          <p className="text-sm text-gray-500">Official rankings and tournament brackets from the Maine Principals' Association.</p>
        </div>
        <a
          href="https://www.mpa.cc/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 bg-bdn-green text-white text-sm font-semibold px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          View on MPA.cc &rarr;
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game Detail Modal (shown when clicking a game)
// ---------------------------------------------------------------------------

// Used to show per-team standings context here (rank/record/qualifying
// status) sourced from scraping MPA.cc's rankings pages. That scrape is gone
// -- MPA.cc's own page structure/ID numbering keeps shifting under us, most
// recently serving one sport's data under another sport's ID entirely -- so
// this is just the game's own details now. Official standings/brackets are a
// link out to MPA.cc instead (see the Standings & Brackets section on the
// page) rather than something re-hosted here.
function GameDetailModal({ game, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!game) return null;
  const state = gameState(game);

  // Embedded, the iframe is the whole page height: cover all of it, and
  // open the card near the click rather than centered in the iframe.
  const overlayClass = EMBED
    ? 'absolute inset-0 z-50 flex justify-center items-start p-4'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';
  const cardStyle = EMBED ? { marginTop: Math.max(0, lastPointerY - 160) } : undefined;

  return (
    <div className={overlayClass} onClick={onClose}>
      {/* Embedded, no dimming: it would stop at the iframe's edges and show
          the frame as a box on the page. */}
      {!EMBED && <div className="absolute inset-0 bg-black bg-opacity-50" />}
      <div
        className={`relative bg-white rounded-lg shadow-2xl ${EMBED ? 'border border-gray-300' : ''} max-w-lg w-full overflow-y-auto p-6 ${EMBED ? '' : 'max-h-[80vh]'}`}
        style={cardStyle}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
        <p className="text-xs font-bold uppercase tracking-wide text-bdn-green mb-1">{sportLabel(game)}</p>
        <p className="text-xs text-gray-500 mb-4">
          {longDate(game.date)}{game.time && <> &bull; {game.time}</>}{game.site && <> &bull; {game.site}</>}
        </p>
        {game.home_score !== undefined && game.away_score !== undefined && game.away_score !== null ? (
          <p className="font-heading text-2xl font-bold text-bdn-gray mb-2">
            {game.away} {game.away_score} &ndash; {game.home_score} {game.home}
          </p>
        ) : (
          <div className="mb-2">
            <p className="font-semibold">{game.home || 'TBD'}{game.home_score !== undefined && ` (${game.home_score})`}</p>
            <p className="text-gray-500 text-sm">vs. {game.away || 'TBD'}</p>
          </div>
        )}
        <StateBadge state={state} game={game} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ lastUpdated }) {
  const formatted = lastUpdated
    ? new Date(lastUpdated).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Unknown';

  return (
    <footer className="mt-12 mb-8 text-center text-xs text-gray-400 space-y-1 px-4">
      <p>Scores &amp; schedules via the Maine Principals' Association. Standings &amp; brackets: <a href="https://www.mpa.cc/" target="_blank" rel="noopener noreferrer" className="underline">mpa.cc</a>.</p>
      <p>Last updated: {formatted}</p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// App (root component)
// ---------------------------------------------------------------------------

/** Open on today if anything is scheduled; otherwise (a Sunday, the
    off-season) on the most recent day that has results. */
function defaultDay(games) {
  const today = todayStr();
  if (games.some(g => g.date === today)) return today;
  return latestFinalsDate(games, today) || today;
}

function App() {
  const [sport, setSport] = useState('');
  const [day, setDay] = useState(null);
  const [followedTeams, setFollowedTeams] = useState(loadFollowedTeams);

  // Data state
  const [schedules, setSchedules] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  useReportHeight();

  // Fetch all data on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [schedRes, featRes] = await Promise.allSettled([
          fetch('data/schedules.json').then(r => r.ok ? r.json() : null),
          fetch('data/featured.json').then(r => r.ok ? r.json() : null),
        ]);
        setSchedules(schedRes.status === 'fulfilled' ? schedRes.value : null);
        setFeatured(featRes.status === 'fulfilled' ? featRes.value : null);
      } catch (err) {
        setError('Failed to load data. Please try again.');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const games = schedules?.games || [];
  const selectedDay = day || defaultDay(games);

  function followTeam(name) {
    setFollowedTeams(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      saveFollowedTeams(next);
      return next;
    });
  }

  function unfollowTeam(name) {
    setFollowedTeams(prev => {
      const next = prev.filter(t => t !== name);
      saveFollowedTeams(next);
      return next;
    });
  }

  function jumpToDay(d) {
    setDay(d);
    setSport('');
    scrollToElement(document.getElementById('scoreboard'));
  }

  const allSchools = useMemo(() => allSchoolNames(games), [schedules]);

  const lastUpdated = schedules?.last_updated || featured?.last_updated;

  // Loading state
  if (loading) {
    return (
      <div>
        <Header lastUpdated={lastUpdated} />
        <div className="max-w-6xl mx-auto px-4 mt-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-bdn-green border-t-transparent" />
          <p className="mt-4 text-gray-500 text-sm">Loading sports data...</p>
        </div>
      </div>
    );
  }

  return (
    // No min-h-screen when embedded: 100vh is the iframe's own height, so the
    // auto-sized iframe could grow but never shrink.
    <div className={EMBED ? 'bg-gray-50 relative' : 'min-h-screen bg-gray-50'}>
      <Header lastUpdated={lastUpdated} />
      <ScoresTicker games={games} onGameClick={setSelectedGame} onSeeAll={jumpToDay} />

      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      <YourTeams
        followed={followedTeams}
        games={games}
        allSchools={allSchools}
        onFollow={followTeam}
        onUnfollow={unfollowTeam}
        onGameClick={setSelectedGame}
      />
      {(!EMBED || EMBED_STORIES) && <TopStories articles={featured?.articles || []} />}

      <Scoreboard
        games={games}
        day={selectedDay}
        setDay={setDay}
        sport={sport}
        setSport={setSport}
        onGameClick={setSelectedGame}
        lastUpdated={schedules?.last_updated}
      />

      <StandingsLinkOut />
      <Footer lastUpdated={lastUpdated} />

      {selectedGame && (
        <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
