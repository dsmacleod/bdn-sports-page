/* ===================================================================
   Maine High School Sports — Bangor Daily News
   Complete React SPA
   =================================================================== */

const { useState, useEffect, useMemo } = React;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentSeason() {
  const m = new Date().getMonth() + 1; // 1-12
  if ([12, 1, 2, 3].includes(m)) return 'winter';
  if ([4, 5, 6].includes(m)) return 'spring';
  return 'fall';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** "2h ago", "Yesterday", "3 days ago" -- day-level granularity, since the
    feed only carries a game's calendar date, not a result-posted timestamp,
    and the scraper itself only runs twice a day. Anything under a day old
    (i.e. from the same refresh cycle as "now") shows hours instead. */
function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'Just in';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** Calendar-day-based freshness label for a game's own date (not a precise
    timestamp -- the feed only carries a date, e.g. "2026-09-17"). */
function daysAgoLabel(dateStr) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  const diffDays = Math.round((new Date(today) - new Date(dateStr)) / 86400000);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  return '';
}

function isPostponed(game) {
  // The feed's own status is authoritative; fall back to the old
  // string-match for anything upstream that didn't set status.
  if (game.status) return game.status === 'Postponed';
  return game.time && game.time.toLowerCase().includes('postponed');
}

function isCanceled(game) {
  return game.status === 'Canceled';
}

function isFinalGame(game, today) {
  // A real score is definitive regardless of date. Otherwise fall back to
  // "past and not postponed/canceled" for anything without a score (e.g.
  // multi-team meets, which don't carry a single home/away score).
  if (game.home_score !== undefined) return true;
  return game.date < today && !isPostponed(game) && !isCanceled(game);
}

/** One game/result card. Shared by the statewide feed and the Your Teams
    section, so a followed team's games look identical to everything else. */
function GameCard({ game, onClick, showFreshness }) {
  const today = todayStr();
  const final = isFinalGame(game, today);
  const postponed = isPostponed(game);
  const canceled = isCanceled(game);
  const hasScore = game.home_score !== undefined && game.away_score !== undefined;
  const freshness = showFreshness && final ? daysAgoLabel(game.date) : '';
  // Today's/yesterday's results are what "recency" is about here -- call
  // them out instead of leaving every result looking equally old.
  const isFresh = freshness === 'Today' || freshness === 'Yesterday';
  return (
    <div
      onClick={() => onClick && onClick(game)}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isFresh ? 'border-bdn-green border-l-4' : 'border-gray-200'
      }`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-400 font-semibold">{formatDate(game.date)}</span>
        <div className="flex gap-1.5">
          {final && (
            <span className="text-xs font-bold text-white bg-bdn-green px-2 py-0.5 rounded uppercase">
              Final{freshness ? ` · ${freshness}` : ''}
            </span>
          )}
          {postponed && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded uppercase">
              PPD
            </span>
          )}
          {canceled && (
            <span className="text-xs font-bold text-white bg-gray-400 px-2 py-0.5 rounded uppercase">
              CXL
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm">{game.home}</span>
          <span className="text-xs text-gray-500">{hasScore ? game.home_score : 'HOME'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700">{game.away}</span>
          <span className="text-xs text-gray-500">{hasScore ? game.away_score : 'AWAY'}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">{game.site}</span>
        {!postponed && !canceled && !hasScore && (
          <span className="text-xs font-semibold text-bdn-green">{game.time}</span>
        )}
      </div>
      <div className="mt-1">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{game.sport}</span>
      </div>
    </div>
  );
}

/** All school names that appear anywhere in the schedule (home, or any
    comma-joined away participant), for the Follow Your Team search. */
function allSchoolNames(games) {
  const set = new Set();
  (games || []).forEach(g => {
    if (g.home) set.add(g.home);
    if (g.away) g.away.split(',').forEach(name => {
      const trimmed = name.trim();
      if (trimmed) set.add(trimmed);
    });
  });
  return Array.from(set).sort();
}

/** Does this game involve the given school, as home or anywhere in the
    (possibly multi-team) away list? */
function gameInvolves(game, teamName) {
  const needle = teamName.toLowerCase();
  if ((game.home || '').toLowerCase() === needle) return true;
  return (game.away || '').toLowerCase().split(',').some(n => n.trim() === needle);
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ lastUpdated }) {
  // Re-render every 30s so "Updated Xh ago" stays accurate without a reload.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="bg-bdn-green text-white py-4 px-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-bdn-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide uppercase">
          Maine High School Sports
        </h1>
        {lastUpdated && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-white bg-opacity-10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-bdn-gold animate-pulse" />
            Updated {timeAgo(lastUpdated)}
          </span>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Season Tabs
// ---------------------------------------------------------------------------

function SeasonTabs({ season, setSeason }) {
  const seasons = ['fall', 'winter', 'spring'];
  return (
    <div className="max-w-6xl mx-auto px-4 mt-4">
      <div className="flex gap-1">
        {seasons.map(s => (
          <button
            key={s}
            onClick={() => setSeason(s)}
            className={`px-5 py-2 font-heading text-sm uppercase tracking-wider rounded-t transition-colors ${
              season === s
                ? 'bg-bdn-gold text-bdn-green font-bold'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="h-0.5 bg-bdn-gold" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Featured Stories Strip
// ---------------------------------------------------------------------------

function FeaturedStories({ articles }) {
  if (!articles || articles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-2">Latest Stories</h2>
        <p className="text-gray-500 text-sm italic">No stories at this time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-bdn-green animate-pulse" />
        Latest Stories
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-72 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
          >
            {a.image && (
              <img src={a.image} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                {a.byline && <span className="text-[11px] text-gray-400">{a.byline}</span>}
                {a.pub_date && <span className="text-[11px] text-bdn-green font-semibold">{timeAgo(a.pub_date)}</span>}
              </div>
              <h3 className="font-heading text-sm font-bold leading-tight group-hover:text-bdn-green transition-colors line-clamp-2">
                {a.title || 'Untitled'}
              </h3>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Bar (main content tabs)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Follow Your Team
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

function FollowTeams({ allSchools, followed, onFollow, onUnfollow }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSchools.filter(s => s.toLowerCase().includes(q) && !followed.includes(s)).slice(0, 8);
  }, [query, allSchools, followed]);

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-2">Follow Your Team</h2>
      <div className="relative max-w-sm">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a school..."
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bdn-gold"
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto">
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
      {followed.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {followed.map(s => (
            <span key={s} className="inline-flex items-center gap-1.5 bg-bdn-green text-white text-sm font-semibold px-3 py-1 rounded-full">
              {s}
              <button onClick={() => onUnfollow(s)} className="text-white hover:text-bdn-gold leading-none" aria-label={`Unfollow ${s}`}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Leads the page once at least one team is followed: that team's most recent
// result plus their next game, for every followed team.
function YourTeams({ followed, games, onGameClick }) {
  if (!followed || followed.length === 0) return null;
  const today = todayStr();

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-bdn-green animate-pulse" />
        Your Teams
      </h2>
      {followed.map(team => {
        // A game dated today isn't "last" until it actually has a score --
        // otherwise a not-yet-played game happening tonight would wrongly
        // show as the most recent result instead of as next up.
        const teamGames = games.filter(g => gameInvolves(g, team));
        const isDone = g => g.home_score !== undefined || g.date < today;
        const past = teamGames.filter(isDone).sort((a, b) => b.date.localeCompare(a.date));
        const next = teamGames.filter(g => !isDone(g)).sort((a, b) => a.date.localeCompare(b.date))[0];
        const last = past[0];
        return (
          <div key={team} className="mb-6">
            <h3 className="font-semibold text-sm text-gray-600 mb-2">{team}</h3>
            {!last && !next ? (
              <p className="text-gray-400 text-sm italic">No games found for this team yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {last && <GameCard game={last} onClick={onGameClick} showFreshness />}
                {next && <GameCard game={next} onClick={onGameClick} />}
              </div>
            )}
          </div>
        );
      })}
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-sm uppercase tracking-wide text-bdn-green mb-1">Standings & Brackets</h2>
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
// Sport Filter
// ---------------------------------------------------------------------------

function SportFilter({ sports, value, onChange, label }) {
  return (
    <div className="max-w-6xl mx-auto px-4 mt-4 flex items-center gap-2">
      <label className="text-sm font-semibold text-gray-600">{label || 'Sport:'}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bdn-gold"
      >
        <option value="">All Sports</option>
        {sports.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
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
  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black bg-opacity-50" />
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          &times;
        </button>
        <h3 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-1">
          Game Details
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          {formatDate(game.date)} &bull; {game.time} &bull; {game.site}
        </p>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{game.sport}</p>
        {game.home_score !== undefined ? (
          <p className="font-heading text-2xl text-bdn-gray mb-2">
            {game.home} {game.home_score} &ndash; {game.away_score} {game.away}
          </p>
        ) : (
          <div className="mb-2">
            <p className="font-semibold">{game.home || 'TBD'}</p>
            <p className="text-gray-500 text-sm">vs. {game.away || 'TBD'}</p>
          </div>
        )}
        {game.status === 'Postponed' && (
          <p className="text-sm font-semibold text-red-500">Postponed</p>
        )}
        {game.status === 'Canceled' && (
          <p className="text-sm font-semibold text-red-500">Canceled</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scores & Schedule Tab
// ---------------------------------------------------------------------------

function ScoresTab({ games, sportFilter, onGameClick }) {
  const today = todayStr();

  const filtered = useMemo(() => {
    if (!games) return [];
    let g = [...games];
    if (sportFilter) {
      g = g.filter(x => {
        // Build label matching filter format: "Sport (Gender)" or just "Sport" for Coed
        const label = (x.gender && x.gender !== 'Coed')
          ? `${x.sport} (${x.gender})`
          : x.sport;
        return label === sportFilter;
      });
    }
    return g;
  }, [games, sportFilter]);

  const todayGames = filtered.filter(g => g.date === today);
  const upcoming = filtered.filter(g => g.date > today).slice(0, 50);
  const recent = filtered.filter(g => g.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);

  function Section({ title, items, emptyMsg, live, showFreshness }) {
    if (!items || items.length === 0) {
      return (
        <div className="mb-8">
          <h3 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3">{title}</h3>
          <p className="text-gray-400 text-sm italic">{emptyMsg}</p>
        </div>
      );
    }
    return (
      <div className="mb-8">
        <h3 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3 flex items-center gap-2">
          {live && <span className="h-2 w-2 rounded-full bg-bdn-green animate-pulse" />}
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((g, i) => <GameCard key={i} game={g} onClick={onGameClick} showFreshness={showFreshness} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      {/* Results lead the page -- this is a scores site, and yesterday's/last
          night's results are the most newsworthy thing on it, not something
          to bury under two other sections. */}
      <Section title="Latest Results" items={recent} emptyMsg="No recent results." live showFreshness />
      <Section title="Today" items={todayGames} emptyMsg="No games scheduled today." />
      <Section title="Upcoming" items={upcoming} emptyMsg="No upcoming games." />
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

function App() {
  const [season, setSeason] = useState(getCurrentSeason());
  const [sportFilter, setSportFilter] = useState('');
  const [followedTeams, setFollowedTeams] = useState(loadFollowedTeams);

  // Data state
  const [schedules, setSchedules] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);

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

  // Build sport options from schedules
  const sportOptions = useMemo(() => {
    const set = new Set();
    if (schedules && schedules.games) {
      schedules.games.forEach(g => {
        if (g.gender && g.gender !== 'Coed') {
          set.add(`${g.sport} (${g.gender})`);
        } else {
          set.add(g.sport);
        }
      });
    }
    return Array.from(set).sort();
  }, [schedules]);

  const allSchools = useMemo(() => allSchoolNames(schedules?.games), [schedules]);

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
    <div className="min-h-screen bg-gray-50">
      <Header lastUpdated={lastUpdated} />
      <SeasonTabs season={season} setSeason={setSeason} />
      <FeaturedStories articles={featured?.articles || []} />

      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      <FollowTeams allSchools={allSchools} followed={followedTeams} onFollow={followTeam} onUnfollow={unfollowTeam} />
      <YourTeams followed={followedTeams} games={schedules?.games || []} onGameClick={setSelectedGame} />

      <SportFilter
        sports={sportOptions}
        value={sportFilter}
        onChange={setSportFilter}
        label="Filter by sport:"
      />
      <ScoresTab games={schedules?.games || []} sportFilter={sportFilter} onGameClick={setSelectedGame} />

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
