"""Tests for scraper.standings — MPA tournament rankings parser."""

import os

from scraper.standings import parse_rankings

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(filename: str) -> str:
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


# ---------------------------------------------------------------------------
# parse_rankings tests
# ---------------------------------------------------------------------------


class TestParseRankings:
    """Tests for TournamentCentralRankings.aspx parser."""

    def test_parse_rankings_returns_list(self):
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        assert isinstance(divisions, list)
        assert len(divisions) > 0

    def test_division_has_name_and_teams(self):
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        div = divisions[0]
        assert "name" in div
        assert "teams" in div
        assert isinstance(div["name"], str)
        assert isinstance(div["teams"], list)
        assert len(div["teams"]) > 0

    def test_division_name_extracted(self):
        """Division name should be 'North-A' from the page header."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        assert divisions[0]["name"] == "North-A"

    def test_team_has_required_fields(self):
        """Each team dict must have rank, team, record, and qualifying."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        team = divisions[0]["teams"][0]
        for field in ("rank", "team", "record", "qualifying"):
            assert field in team, f"Missing field: {field}"

    def test_team_has_index_field(self):
        """Each team should also include the tournament index."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        team = divisions[0]["teams"][0]
        assert "index" in team
        assert isinstance(team["index"], float)

    def test_qualifying_teams_flagged(self):
        """Teams from Ranking_Table should have qualifying=True."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        teams = divisions[0]["teams"]
        qualifying = [t for t in teams if t["qualifying"]]
        non_qualifying = [t for t in teams if not t["qualifying"]]
        assert len(qualifying) == 8
        assert len(non_qualifying) == 4

    def test_first_team_values(self):
        """Verify the first team matches the known fixture data."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        first = divisions[0]["teams"][0]
        assert first["rank"] == 1
        assert first["team"] == "Camden Hills Regional"
        assert first["record"] == "17-1-0"
        assert first["index"] == 173.457
        assert first["qualifying"] is True

    def test_last_qualifying_team(self):
        """Rank 8 (Skowhegan Area) should be the last qualifying team."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        teams = divisions[0]["teams"]
        qualifying = [t for t in teams if t["qualifying"]]
        last_q = qualifying[-1]
        assert last_q["rank"] == 8
        assert last_q["team"] == "Skowhegan Area"
        assert last_q["qualifying"] is True

    def test_first_non_qualifying_team(self):
        """Rank 9 (Brewer) should be the first non-qualifying team."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        teams = divisions[0]["teams"]
        non_qualifying = [t for t in teams if not t["qualifying"]]
        first_nq = non_qualifying[0]
        assert first_nq["rank"] == 9
        assert first_nq["team"] == "Brewer"
        assert first_nq["qualifying"] is False

    def test_total_team_count(self):
        """Should have 12 total teams (8 qualifying + 4 non-qualifying)."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        assert len(divisions[0]["teams"]) == 12

    def test_teams_ordered_by_rank(self):
        """Teams should be in rank order."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        teams = divisions[0]["teams"]
        ranks = [t["rank"] for t in teams]
        assert ranks == list(range(1, 13))

    def test_empty_html_returns_empty_list(self):
        divisions = parse_rankings("<html><body></body></html>")
        assert divisions == []

    def test_record_strips_win_pct(self):
        """Record should be just W-L-T without the parenthetical win pct."""
        html = _load("rankings.html")
        divisions = parse_rankings(html)
        for team in divisions[0]["teams"]:
            assert "(" not in team["record"]
            assert ")" not in team["record"]
            parts = team["record"].split("-")
            assert len(parts) == 3  # W-L-T format
