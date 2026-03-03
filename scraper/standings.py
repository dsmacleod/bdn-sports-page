"""Parse MPA.cc tournament rankings (standings) pages."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup


def _parse_record(raw: str) -> str:
    """Extract W-L-T record from a string like '17-1-0 (0.944)'.

    Strips the parenthetical win percentage if present.
    """
    raw = raw.strip()
    # Match the W-L-T portion before any parenthetical
    m = re.match(r"(\d+-\d+-\d+)", raw)
    if m:
        return m.group(1)
    return raw


def _parse_table_rows(table, qualifying: bool) -> list[dict]:
    """Parse team rows from a Ranking_Table or NonRanking_Table.

    Each data row has columns: Rank, School, Record, Prel Indx, Tour Indx, Detail.
    """
    teams: list[dict] = []
    rows = table.find_all("tr")
    if not rows:
        return teams

    # First row is header, skip it
    for row in rows[1:]:
        cells = row.find_all("td")
        if len(cells) < 5:
            continue

        rank_text = cells[0].get_text(strip=True)
        try:
            rank = int(rank_text)
        except ValueError:
            continue

        # School name: text of the <a> inside the school cell, or cell text
        school_cell = cells[1]
        link = school_cell.find("a")
        team_name = link.get_text(strip=True) if link else school_cell.get_text(strip=True)

        record_raw = cells[2].get_text(strip=True)
        record = _parse_record(record_raw)

        # Tournament Index is column 4 (0-indexed)
        tour_idx_text = cells[4].get_text(strip=True)
        try:
            tour_idx = float(tour_idx_text)
        except ValueError:
            tour_idx = 0.0

        teams.append({
            "rank": rank,
            "team": team_name,
            "record": record,
            "index": tour_idx,
            "qualifying": qualifying,
        })

    return teams


def _extract_division_name(soup: BeautifulSoup) -> str:
    """Extract division name from the page header.

    The header ``<h2>`` inside ``.HeaderText`` has the format:
    ``2025-2026 Division North-A HS - Boys Basketball``

    We extract the division name between 'Division ' and ' HS'.
    """
    header_div = soup.find("div", class_="HeaderText")
    if not header_div:
        return ""
    h2 = header_div.find("h2")
    if not h2:
        return ""
    text = h2.get_text(strip=True)
    m = re.search(r"Division\s+(.+?)\s+HS", text)
    if m:
        return m.group(1)
    return text


def parse_rankings(html: str) -> list[dict]:
    """Parse TournamentCentralRankings.aspx HTML.

    The page shows one division at a time.  It contains two tables:
    ``#Ranking_Table`` for qualifying teams and ``#NonRanking_Table``
    for non-qualifying teams.

    Returns a list of division dicts (typically one per page)::

        [
          {
            "name": "North-A",
            "teams": [
              {"rank": 1, "team": "Camden Hills Regional",
               "record": "17-1-0", "index": 173.457, "qualifying": True},
              ...
            ]
          }
        ]
    """
    soup = BeautifulSoup(html, "lxml")

    division_name = _extract_division_name(soup)
    if not division_name:
        return []

    teams: list[dict] = []

    # Qualifying teams
    ranking_table = soup.find("table", id="Ranking_Table")
    if ranking_table:
        teams.extend(_parse_table_rows(ranking_table, qualifying=True))

    # Non-qualifying teams
    non_ranking_table = soup.find("table", id="NonRanking_Table")
    if non_ranking_table:
        teams.extend(_parse_table_rows(non_ranking_table, qualifying=False))

    if not teams:
        return []

    return [{"name": division_name, "teams": teams}]


def fetch_standings(
    session,
    base_url: str,
    tournament_ids: list[int],
) -> dict[int, list[dict]]:
    """Fetch standings for each sport tournament ID.

    For each tournament ID, fetches the default rankings page (which
    shows the first division).  To get all divisions, the caller would
    need to follow the division links in ``#DivisionPanel``.

    Args:
        session: A ``requests.Session`` (or compatible) with headers set.
        base_url: The MPA base URL, e.g. ``https://www.mpa.cc``.
        tournament_ids: List of TournamentID values to fetch.

    Returns:
        Dict keyed by tournament_id with list of division dicts as values.
    """
    results: dict[int, list[dict]] = {}

    for tid in tournament_ids:
        url = f"{base_url}/TournamentCentralRankings.aspx?TournamentID={tid}"
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        divisions = parse_rankings(resp.text)
        results[tid] = divisions

    return results
