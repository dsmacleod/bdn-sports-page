"""Parse MPA.cc schedule and scores pages."""

from __future__ import annotations

from datetime import datetime

from bs4 import BeautifulSoup


def _parse_mpa_date(raw: str) -> str:
    """Convert MPA date format (MM/DD/YYYY) to ISO format (YYYY-MM-DD).

    Returns the original string stripped if parsing fails.
    """
    raw = raw.strip()
    try:
        dt = datetime.strptime(raw, "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return raw


def parse_master_schedule(html: str) -> list[dict]:
    """Parse MPA MasterSchedule.aspx into a list of game dicts.

    Each table with class ``dsTable`` is parsed.  The header row
    provides column names: GameDate, Time, Type, Home School,
    Away School, Site.  The preceding ``<h2>`` gives the sport heading.

    Returns a list of dicts with keys:
        date  -- YYYY-MM-DD
        time  -- e.g. "9:00 AM" or "Postponed"
        type  -- e.g. "League"
        home  -- home school name
        away  -- away school name(s), comma-separated
        site  -- venue name
        sport -- sport heading from the <h2> (if present)
    """
    soup = BeautifulSoup(html, "lxml")
    games: list[dict] = []

    for table in soup.find_all("table", class_="dsTable"):
        # Try to find the sport heading from the preceding <h2>
        sport_heading = ""
        wrapper = table.find_parent("div", class_="regularseasonwrapper")
        if wrapper:
            h2 = wrapper.find("h2")
            if h2:
                sport_heading = h2.get_text(strip=True)

        rows = table.find_all("tr")
        if not rows:
            continue

        # First row is the header
        headers = [th.get_text(strip=True) for th in rows[0].find_all("th")]
        if not headers:
            continue

        # Build a column-name-to-index map
        col_map = {}
        for idx, header in enumerate(headers):
            col_map[header] = idx

        # Parse data rows
        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue

            def _cell(name: str) -> str:
                idx = col_map.get(name)
                if idx is not None and idx < len(cells):
                    return cells[idx].get_text(strip=True)
                return ""

            raw_date = _cell("GameDate")
            game = {
                "date": _parse_mpa_date(raw_date),
                "time": _cell("Time"),
                "type": _cell("Type"),
                "home": _cell("Home School"),
                "away": _cell("Away School"),
                "site": _cell("Site"),
            }
            if sport_heading:
                game["sport"] = sport_heading

            games.append(game)

    return games


def parse_dashboard(html: str) -> dict:
    """Parse MPA DashboardSchedule.aspx into today's games and results.

    The page uses a ``<table class="TileTable">`` with ``<tr class="rowGame">``
    rows.  Each row contains:
        - TD 0: ``<span class="date">`` and ``<span class="time">``
        - TD 2: ``<span class="sport">``, ``<span class="level">``,
          ``<div class="teams">`` containing ``<div class="team">`` elements.
          Home team is identified by a ``<i>`` with ``fa-house`` class.
          Scores (if present) use ``<span class="scoreright">``.
        - TD 4: ``<span class="site">`` and ``<span class="subsite">``

    Returns a dict with keys:
        title   -- the h3 heading (e.g. "Today's Games - All HS")
        today   -- list of game dicts for today's games
        results -- list of game dicts that include scores
    """
    soup = BeautifulSoup(html, "lxml")

    # Extract the section heading
    h3 = soup.find("h3")
    title = h3.get_text(strip=True) if h3 else ""

    today_games: list[dict] = []
    results: list[dict] = []

    for table in soup.find_all("table", class_="TileTable"):
        for row in table.find_all("tr", class_="rowGame"):
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            # Date and time (TD 0)
            date_span = cells[0].find("span", class_="date")
            time_span = cells[0].find("span", class_="time")
            date_text = date_span.get_text(strip=True) if date_span else ""
            time_text = time_span.get_text(strip=True) if time_span else ""

            # Sport and level (TD 2)
            sport_span = cells[2].find("span", class_="sport")
            level_span = cells[2].find("span", class_="level")
            sport = sport_span.get_text(strip=True) if sport_span else ""
            level = level_span.get_text(strip=True) if level_span else ""

            # Teams (TD 2)
            teams_div = cells[2].find("div", class_="teams")
            teams = []
            home_team = ""
            if teams_div:
                for team_div in teams_div.find_all("div", class_="team"):
                    team_name = team_div.get_text(strip=True)
                    is_home = (
                        team_div.find(
                            "i",
                            class_=lambda c: c and "fa-house" in c
                        )
                        is not None
                    )
                    teams.append({"name": team_name, "is_home": is_home})
                    if is_home:
                        home_team = team_name

            # Scores (TD 2) -- scoreright spans next to teams
            score_spans = cells[2].find_all("span", class_="scoreright")
            scores = [s.get_text(strip=True) for s in score_spans]
            has_score = any(s for s in scores)

            # Site (TD 4)
            site_span = cells[4].find("span", class_="site")
            subsite_span = cells[4].find("span", class_="subsite")
            site = site_span.get_text(strip=True) if site_span else ""
            subsite = subsite_span.get_text(strip=True) if subsite_span else ""

            game = {
                "date": date_text,
                "time": time_text,
                "sport": sport,
                "level": level,
                "teams": teams,
                "home": home_team,
                "site": site,
                "subsite": subsite,
            }

            if has_score:
                game["scores"] = scores
                results.append(game)
            else:
                today_games.append(game)

    return {
        "title": title,
        "today": today_games,
        "results": results,
    }


def fetch_schedules(
    session,
    base_url: str,
    sport_configs: list[dict] | None = None,
    team_level_id: int = 5,
) -> list[dict]:
    """Fetch MasterSchedule pages from MPA for each sport.

    When *sport_configs* is provided (a list of dicts with ``schedule_id``,
    ``sport``, and ``gender`` keys), each sport's schedule page is fetched
    individually using ``SportGenderListID``.  The sport name and gender
    are added to every game dict returned.

    When *sport_configs* is ``None``, the old behaviour is preserved:
    a single page for the given *team_level_id* is fetched.

    Args:
        session: A ``requests.Session`` (or compatible) with headers set.
        base_url: The MPA base URL, e.g. ``https://www.mpa.cc``.
        sport_configs: List of sport config dicts from ``config.SPORTS``.
            Each must contain ``schedule_id``, ``sport``, and ``gender``.
        team_level_id: TeamLevelID value (default ``5`` for Varsity).

    Returns:
        Combined list of game dicts from all fetched pages.
    """
    all_games: list[dict] = []

    if sport_configs is None:
        # Legacy fallback: fetch a single page without SportGenderListID
        url = f"{base_url}/MasterSchedule.aspx?TeamLevelID={team_level_id}"
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        all_games.extend(parse_master_schedule(resp.text))
        return all_games

    for cfg in sport_configs:
        schedule_id = cfg["schedule_id"]
        sport_name = cfg["sport"]
        gender = cfg["gender"]
        url = (
            f"{base_url}/MasterSchedule.aspx"
            f"?TeamLevelID={team_level_id}"
            f"&SportGenderListID={schedule_id}"
        )
        print(f"  Fetching schedule: {sport_name} ({gender}) ...")
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        games = parse_master_schedule(resp.text)
        # Override sport with our config name and add gender
        for game in games:
            game["sport"] = sport_name
            game["gender"] = gender
        all_games.extend(games)

    return all_games
