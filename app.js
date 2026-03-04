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

function sportLabel(sportEntry) {
  if (sportEntry.gender && sportEntry.gender !== 'Coed') {
    return `${sportEntry.sport} (${sportEntry.gender})`;
  }
  return sportEntry.sport;
}

/** Determine the winner of a bracket matchup. Returns 1, 2, or 0 (no winner). */
function matchupWinner(m) {
  const s1 = parseInt(m.score1, 10);
  const s2 = parseInt(m.score2, 10);
  if (isNaN(s1) || isNaN(s2)) return 0;
  if (s1 > s2) return 1;
  if (s2 > s1) return 2;
  return 0;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header() {
  return (
    <header className="bg-bdn-green text-white py-4 px-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-bdn-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide uppercase">
          Maine High School Sports
        </h1>
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
        <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-2">Featured Stories</h2>
        <p className="text-gray-500 text-sm italic">No featured stories at this time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <h2 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3">Featured Stories</h2>
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
              <h3 className="font-heading text-sm font-bold leading-tight group-hover:text-bdn-green transition-colors line-clamp-2">
                {a.title || 'Untitled'}
              </h3>
              {a.summary && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.summary}</p>
              )}
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

function TabBar({ activeTab, setActiveTab, showBrackets }) {
  const tabs = [
    { id: 'scores', label: 'Scores & Schedule' },
    { id: 'standings', label: 'Standings' },
  ];
  if (showBrackets) {
    tabs.push({ id: 'brackets', label: 'Brackets' });
  }
  tabs.push({ id: 'compare', label: 'Team Compare' });

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-bdn-green text-bdn-green bg-white'
                : 'border-transparent text-gray-500 hover:text-bdn-green hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="h-px bg-gray-200" />
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
// Team Detail Modal (shown when clicking a game)
// ---------------------------------------------------------------------------

function TeamDetailModal({ game, standings, onClose }) {
  if (!game) return null;

  // Find standings entries for home and away teams
  function findTeamStandings(teamName) {
    if (!standings || !standings.sports || !teamName) return [];
    const matches = [];
    standings.sports.forEach(sportEntry => {
      sportEntry.divisions.forEach(div => {
        div.teams.forEach(t => {
          if (t.team.toLowerCase().includes(teamName.toLowerCase()) ||
              teamName.toLowerCase().includes(t.team.toLowerCase())) {
            matches.push({
              ...t,
              sport: sportLabel(sportEntry),
              division: div.name,
            });
          }
        });
      });
    });
    return matches;
  }

  const homeStandings = findTeamStandings(game.home);
  const awayStandings = findTeamStandings(game.away);

  function TeamSection({ label, teamName, entries }) {
    return (
      <div className="mb-4">
        <h4 className="font-heading text-sm uppercase tracking-wide text-bdn-green mb-2">
          {label}: {teamName}
        </h4>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No standings data found</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{e.sport} — {e.division}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${e.qualifying ? 'bg-bdn-green text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {e.qualifying ? 'Qualifying' : 'Not qualifying'}
                  </span>
                </div>
                <div className="flex gap-6 mt-2 text-gray-600">
                  <span>Rank: <strong>#{e.rank}</strong></span>
                  <span>Record: <strong>{e.record}</strong></span>
                  <span>Index: <strong>{e.index.toFixed(3)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">{game.sport}</p>

        <TeamSection label="Home" teamName={game.home} entries={homeStandings} />
        <TeamSection label="Away" teamName={game.away} entries={awayStandings} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scores & Schedule Tab
// ---------------------------------------------------------------------------

function ScoresTab({ games, sportFilter, standings, onGameClick }) {
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

  function isPostponed(game) {
    return game.time && game.time.toLowerCase().includes('postponed');
  }

  function isFinal(game) {
    // Games in the past that aren't postponed are considered final
    return game.date < today && !isPostponed(game);
  }

  function GameCard({ game }) {
    const final = isFinal(game);
    const postponed = isPostponed(game);
    return (
      <div
        onClick={() => onGameClick && onGameClick(game)}
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs text-gray-400 font-semibold">{formatDate(game.date)}</span>
          <div className="flex gap-1.5">
            {final && (
              <span className="text-xs font-bold text-white bg-bdn-green px-2 py-0.5 rounded uppercase">
                Final
              </span>
            )}
            {postponed && (
              <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded uppercase">
                PPD
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">{game.home}</span>
            <span className="text-xs text-gray-500">HOME</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700">{game.away}</span>
            <span className="text-xs text-gray-500">AWAY</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">{game.site}</span>
          {!postponed && (
            <span className="text-xs font-semibold text-bdn-green">{game.time}</span>
          )}
        </div>
        <div className="mt-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">{game.sport}</span>
        </div>
      </div>
    );
  }

  function Section({ title, items, emptyMsg }) {
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
        <h3 className="font-heading text-lg uppercase tracking-wide text-bdn-green mb-3">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((g, i) => <GameCard key={i} game={g} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <Section title="Today" items={todayGames} emptyMsg="No games scheduled today." />
      <Section title="Upcoming" items={upcoming} emptyMsg="No upcoming games." />
      <Section title="Recent Results" items={recent} emptyMsg="No recent results." />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standings Tab
// ---------------------------------------------------------------------------

function StandingsTab({ standings, sportFilter }) {
  const [sortCol, setSortCol] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    if (!standings || !standings.sports) return [];
    let list = standings.sports;
    if (sportFilter) {
      list = list.filter(s => {
        const label = sportLabel(s);
        return label === sportFilter;
      });
    }
    return list;
  }, [standings, sportFilter]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'rank' ? 'asc' : 'desc');
    }
  }

  function sortTeams(teams) {
    const sorted = [...teams].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'team') {
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (sortCol === 'record') {
        // Sort by wins
        const winsA = parseInt((va || '0').split('-')[0], 10);
        const winsB = parseInt((vb || '0').split('-')[0], 10);
        return sortDir === 'asc' ? winsA - winsB : winsB - winsA;
      }
      va = typeof va === 'number' ? va : 0;
      vb = typeof vb === 'number' ? vb : 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return sorted;
  }

  const arrow = sortDir === 'asc' ? '\u25B2' : '\u25BC';

  function ColHeader({ col, label }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${
          active ? 'text-bdn-green' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className={active ? 'border-b-2 border-bdn-gold pb-0.5' : ''}>
          {label} {active ? arrow : ''}
        </span>
      </th>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <p className="text-gray-400 text-sm italic">No standings data available.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6 space-y-8">
      {filtered.map((sportEntry, si) => (
        <div key={si}>
          <h3 className="font-heading text-xl uppercase tracking-wide text-bdn-green mb-3">
            {sportLabel(sportEntry)}
          </h3>
          {sportEntry.divisions.map((div, di) => (
            <div key={di} className="mb-6">
              <h4 className="font-heading text-sm uppercase text-gray-500 tracking-wide mb-2">
                {div.name}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <ColHeader col="rank" label="Rank" />
                      <ColHeader col="team" label="Team" />
                      <ColHeader col="record" label="Record" />
                      <ColHeader col="index" label="Tournament Index" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortTeams(div.teams).map((team, ti) => (
                      <tr
                        key={ti}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          team.qualifying ? 'border-l-4 border-l-bdn-green' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-gray-600">{team.rank}</td>
                        <td className="px-3 py-2 font-semibold">{team.team}</td>
                        <td className="px-3 py-2 text-gray-600">{team.record}</td>
                        <td className="px-3 py-2 text-gray-600">{team.index.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Comparison Tab
// ---------------------------------------------------------------------------

function TeamCompare({ standings, sportFilter }) {
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');

  // Build flat list of all teams with their metadata
  const allTeams = useMemo(() => {
    if (!standings || !standings.sports) return [];
    const map = new Map();
    standings.sports.forEach(sportEntry => {
      sportEntry.divisions.forEach(div => {
        div.teams.forEach(t => {
          const key = `${t.team}|||${sportLabel(sportEntry)}|||${div.name}`;
          if (!map.has(key)) {
            map.set(key, {
              key,
              team: t.team,
              sport: sportLabel(sportEntry),
              division: div.name,
              rank: t.rank,
              record: t.record,
              index: t.index,
              qualifying: t.qualifying,
            });
          }
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.team.localeCompare(b.team));
  }, [standings]);

  // Filter teams by sport when sport filter is active
  const filteredTeams = useMemo(() => {
    if (!sportFilter) return allTeams;
    return allTeams.filter(t => t.sport === sportFilter);
  }, [allTeams, sportFilter]);

  // Clear selections if they're no longer in filtered list
  useEffect(() => {
    if (teamA && !filteredTeams.find(t => t.key === teamA)) setTeamA('');
    if (teamB && !filteredTeams.find(t => t.key === teamB)) setTeamB('');
  }, [filteredTeams]);

  const entryA = allTeams.find(t => t.key === teamA);
  const entryB = allTeams.find(t => t.key === teamB);

  const maxIndex = Math.max(entryA?.index || 0, entryB?.index || 0, 1);

  function StatCard({ entry, color }) {
    if (!entry) {
      return (
        <div className="flex-1 bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-400 text-sm">Select a team</p>
        </div>
      );
    }
    return (
      <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
        <h4 className="font-heading text-lg font-bold uppercase">{entry.team}</h4>
        <p className="text-xs text-gray-500 mt-1">{entry.sport} &mdash; {entry.division}</p>
        <p className="text-4xl font-heading font-bold mt-4" style={{ color }}>
          {entry.record}
        </p>
        <p className="text-xs text-gray-500 mt-1 uppercase">Record</p>
        <p className="text-2xl font-heading font-bold mt-3">
          #{entry.rank}
        </p>
        <p className="text-xs text-gray-500 mt-1 uppercase">Division Rank</p>
        <p className="text-sm mt-2">
          {entry.qualifying
            ? <span className="text-bdn-green font-semibold">Qualifying</span>
            : <span className="text-gray-400">Not qualifying</span>
          }
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-600 block mb-1">Team A</label>
          <select
            value={teamA}
            onChange={e => setTeamA(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bdn-green"
          >
            <option value="">-- Select team --</option>
            {filteredTeams.map(t => (
              <option key={t.key} value={t.key}>
                {t.team} ({t.sport}, {t.division})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-center">
          <span className="font-heading text-2xl font-bold text-gray-300 pb-2">VS</span>
        </div>
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-600 block mb-1">Team B</label>
          <select
            value={teamB}
            onChange={e => setTeamB(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bdn-gold"
          >
            <option value="">-- Select team --</option>
            {filteredTeams.map(t => (
              <option key={t.key} value={t.key}>
                {t.team} ({t.sport}, {t.division})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-side stat cards */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <StatCard entry={entryA} color="#00331b" />
        <StatCard entry={entryB} color="#f1bc38" />
      </div>

      {/* Bar chart comparing tournament indices */}
      {(entryA || entryB) && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h4 className="font-heading text-sm uppercase tracking-wide text-gray-500 mb-4">Tournament Index Comparison</h4>
          <p className="text-xs text-gray-400 -mt-3 mb-4">MPA ranking score based on strength of schedule and win percentage</p>
          <div className="space-y-4">
            {entryA && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{entryA.team}</span>
                  <span className="text-gray-500">{entryA.index.toFixed(3)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-6 rounded-full bg-bdn-green transition-all duration-500"
                    style={{ width: `${Math.max((entryA.index / maxIndex) * 100, 2)}%` }}
                  />
                </div>
              </div>
            )}
            {entryB && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{entryB.team}</span>
                  <span className="text-gray-500">{entryB.index.toFixed(3)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-6 rounded-full bg-bdn-gold transition-all duration-500"
                    style={{ width: `${Math.max((entryB.index / maxIndex) * 100, 2)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brackets Tab
// ---------------------------------------------------------------------------

function BracketsTab({ bracketsData, sportFilter }) {
  const activeSports = useMemo(() => {
    if (!bracketsData || !bracketsData.sports) return [];
    return bracketsData.sports.filter(s => s.tournament_active && s.brackets && s.brackets.length > 0);
  }, [bracketsData]);

  const filtered = useMemo(() => {
    if (!sportFilter) return activeSports;
    return activeSports.filter(s => {
      const label = sportLabel(s);
      return label === sportFilter;
    });
  }, [activeSports, sportFilter]);

  if (filtered.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <p className="text-gray-400 text-sm italic">No active tournament brackets.</p>
      </div>
    );
  }

  function MatchupCard({ matchup }) {
    const winner = matchupWinner(matchup);
    const hasBye = matchup.score1 === 'BYE' || matchup.score2 === 'BYE';
    const hasScores = matchup.score1 && matchup.score2 && !hasBye;
    const isComplete = hasScores && winner !== 0;
    const isTBD = matchup.team1 === 'TBD' && matchup.team2 === 'TBD';

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm min-w-[220px] text-sm">
        {matchup.header && (
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 leading-tight">
            {matchup.header}
          </div>
        )}
        <div className={`px-3 py-2 flex justify-between items-center border-b border-gray-100 ${winner === 1 ? 'font-bold' : ''}`}>
          <span className="flex items-center gap-1.5">
            {matchup.seed1 && <span className="text-[10px] text-gray-400">({matchup.seed1})</span>}
            <span className={winner === 1 ? 'text-bdn-green' : isTBD ? 'text-gray-400 italic' : ''}>
              {matchup.team1 || '\u2014'}
            </span>
          </span>
          <span className="ml-3 tabular-nums">
            {hasBye && matchup.score1 === 'BYE' ? (
              <span className="text-[10px] text-gray-400 uppercase">BYE</span>
            ) : (
              matchup.score1 || ''
            )}
          </span>
        </div>
        <div className={`px-3 py-2 flex justify-between items-center ${winner === 2 ? 'font-bold' : ''}`}>
          <span className="flex items-center gap-1.5">
            {matchup.seed2 && <span className="text-[10px] text-gray-400">({matchup.seed2})</span>}
            <span className={winner === 2 ? 'text-bdn-green' : ''}>
              {matchup.team2 || '\u2014'}
            </span>
          </span>
          <span className="ml-3 tabular-nums">
            {hasBye && matchup.score2 === 'BYE' ? (
              <span className="text-[10px] text-gray-400 uppercase">BYE</span>
            ) : (
              matchup.score2 || ''
            )}
          </span>
        </div>
        {isComplete && (
          <div className="px-3 py-1 bg-bdn-green text-white text-[10px] text-center uppercase font-bold tracking-wide rounded-b-lg">
            Final
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6 space-y-10">
      {filtered.map((sportEntry, si) => (
        <div key={si}>
          <h3 className="font-heading text-xl uppercase tracking-wide text-bdn-green mb-1">
            {sportLabel(sportEntry)}
          </h3>
          <p className="text-xs text-gray-500 mb-4">{sportEntry.class_name}</p>

          {/* Horizontal bracket flow */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6 items-start" style={{ minWidth: 'max-content' }}>
              {sportEntry.brackets.map((round, ri) => (
                <div key={ri} className="flex flex-col items-center">
                  <h5 className="font-heading text-xs uppercase text-gray-500 tracking-wide mb-3 text-center whitespace-nowrap">
                    {round.class_name}
                  </h5>
                  <div className="flex flex-col gap-3 justify-center">
                    {round.matchups.map((m, mi) => (
                      <MatchupCard key={mi} matchup={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
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
      <p>Data via Maine Principals' Association.</p>
      <p>Last updated: {formatted}</p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// App (root component)
// ---------------------------------------------------------------------------

function App() {
  const [season, setSeason] = useState(getCurrentSeason());
  const [activeTab, setActiveTab] = useState('scores');
  const [sportFilter, setSportFilter] = useState('');

  // Data state
  const [schedules, setSchedules] = useState(null);
  const [standings, setStandings] = useState(null);
  const [brackets, setBrackets] = useState(null);
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
        const [schedRes, standRes, brackRes, featRes] = await Promise.allSettled([
          fetch('data/schedules.json').then(r => r.ok ? r.json() : null),
          fetch('data/standings.json').then(r => r.ok ? r.json() : null),
          fetch('data/brackets.json').then(r => r.ok ? r.json() : null),
          fetch('data/featured.json').then(r => r.ok ? r.json() : null),
        ]);
        setSchedules(schedRes.status === 'fulfilled' ? schedRes.value : null);
        setStandings(standRes.status === 'fulfilled' ? standRes.value : null);
        setBrackets(brackRes.status === 'fulfilled' ? brackRes.value : null);
        setFeatured(featRes.status === 'fulfilled' ? featRes.value : null);
      } catch (err) {
        setError('Failed to load data. Please try again.');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Build sport options from schedules + standings using consistent labels
  const sportOptions = useMemo(() => {
    const set = new Set();
    if (schedules && schedules.games) {
      schedules.games.forEach(g => {
        // Build label matching standings format: "Sport (Gender)" or just "Sport" for Coed
        if (g.gender && g.gender !== 'Coed') {
          set.add(`${g.sport} (${g.gender})`);
        } else {
          set.add(g.sport);
        }
      });
    }
    if (standings && standings.sports) {
      standings.sports.forEach(s => set.add(sportLabel(s)));
    }
    return Array.from(set).sort();
  }, [schedules, standings]);

  // Check if any brackets are active
  const showBrackets = useMemo(() => {
    if (!brackets || !brackets.sports) return false;
    return brackets.sports.some(s => s.tournament_active && s.brackets && s.brackets.length > 0);
  }, [brackets]);

  // Determine last_updated from any available data
  const lastUpdated = schedules?.last_updated || standings?.last_updated || brackets?.last_updated || featured?.last_updated;

  // Loading state
  if (loading) {
    return (
      <div>
        <Header />
        <div className="max-w-6xl mx-auto px-4 mt-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-bdn-green border-t-transparent" />
          <p className="mt-4 text-gray-500 text-sm">Loading sports data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <SeasonTabs season={season} setSeason={setSeason} />
      <FeaturedStories articles={featured?.articles || []} />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} showBrackets={showBrackets} />
      <SportFilter
        sports={sportOptions}
        value={sportFilter}
        onChange={setSportFilter}
        label="Filter by sport:"
      />

      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'scores' && (
        <ScoresTab games={schedules?.games || []} sportFilter={sportFilter} standings={standings} onGameClick={setSelectedGame} />
      )}
      {activeTab === 'standings' && (
        <StandingsTab standings={standings} sportFilter={sportFilter} />
      )}
      {activeTab === 'brackets' && (
        <BracketsTab bracketsData={brackets} sportFilter={sportFilter} />
      )}
      {activeTab === 'compare' && (
        <TeamCompare standings={standings} sportFilter={sportFilter} />
      )}

      <Footer lastUpdated={lastUpdated} />

      {selectedGame && (
        <TeamDetailModal game={selectedGame} standings={standings} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
