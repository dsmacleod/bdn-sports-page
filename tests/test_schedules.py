"""Tests for scraper.schedules — MPA schedule and scores parsers."""

import os

from scraper.schedules import parse_master_schedule, parse_dashboard

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(filename: str) -> str:
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


# ---------------------------------------------------------------------------
# parse_master_schedule tests
# ---------------------------------------------------------------------------


class TestParseMasterSchedule:
    """Tests for the MasterSchedule.aspx parser."""

    def test_returns_list(self):
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        assert isinstance(games, list)
        assert len(games) > 0

    def test_game_has_required_fields(self):
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        game = games[0]
        for field in ("date", "time", "home", "away", "site", "type"):
            assert field in game, f"Missing field: {field}"

    def test_date_format_is_iso(self):
        """Dates should be YYYY-MM-DD format."""
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        date = games[0]["date"]
        assert date.count("-") == 2
        assert len(date) == 10
        # Should start with a 4-digit year
        year = date.split("-")[0]
        assert len(year) == 4 and year.isdigit()

    def test_first_game_values(self):
        """Verify the first game matches the known fixture data."""
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        first = games[0]
        assert first["date"] == "2026-01-03"
        assert first["time"] == "9:00 AM"
        assert first["type"] == "League"
        assert first["home"] == "Caribou"
        assert "Presque Isle" in first["away"]
        assert first["site"] == "Big Rock Mt."

    def test_sport_heading_present(self):
        """Each game should include the sport heading from the <h2>."""
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        assert "sport" in games[0]
        assert "Alpine Ski" in games[0]["sport"]

    def test_multiple_games_parsed(self):
        """The fixture has 50 data rows (51 rows minus header)."""
        html = _load("master_schedule.html")
        games = parse_master_schedule(html)
        assert len(games) == 50

    def test_empty_html_returns_empty_list(self):
        games = parse_master_schedule("<html><body></body></html>")
        assert games == []

    def test_no_data_rows_returns_empty_list(self):
        html = """
        <html><body>
        <table class="dsTable">
            <tr><th>GameDate</th><th>Time</th><th>Type</th>
                <th>Home School</th><th>Away School</th><th>Site</th></tr>
        </table>
        </body></html>
        """
        games = parse_master_schedule(html)
        assert games == []


# ---------------------------------------------------------------------------
# parse_dashboard tests
# ---------------------------------------------------------------------------


class TestParseDashboard:
    """Tests for the DashboardSchedule.aspx parser."""

    def test_returns_dict_with_today_and_results(self):
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        assert "today" in data
        assert "results" in data
        assert isinstance(data["today"], list)
        assert isinstance(data["results"], list)

    def test_title_extracted(self):
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        assert "title" in data
        assert "Today" in data["title"]

    def test_today_games_have_required_fields(self):
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        assert len(data["today"]) > 0
        game = data["today"][0]
        for field in ("date", "time", "sport", "teams", "home", "site"):
            assert field in game, f"Missing field: {field}"

    def test_today_games_count(self):
        """The fixture has 9 rowGame rows, all without scores."""
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        assert len(data["today"]) == 9

    def test_results_empty_when_no_scores(self):
        """The fixture has no scored games, so results should be empty."""
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        assert data["results"] == []

    def test_first_game_values(self):
        """Verify the first dashboard game matches fixture data."""
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        first = data["today"][0]
        assert first["date"] == "TUE 3/3"
        assert first["time"] == "1:00 PM"
        assert first["sport"] == "Unified Basketball"
        assert first["home"] == "Maranacook Community"
        assert first["site"] == "Maranacook HS"

    def test_teams_have_home_indicator(self):
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        first = data["today"][0]
        teams = first["teams"]
        assert len(teams) >= 2
        # First team should be home
        home_teams = [t for t in teams if t["is_home"]]
        away_teams = [t for t in teams if not t["is_home"]]
        assert len(home_teams) == 1
        assert len(away_teams) >= 1

    def test_empty_html_returns_empty_lists(self):
        data = parse_dashboard("<html><body></body></html>")
        assert data["today"] == []
        assert data["results"] == []

    def test_game_with_multiple_away_teams(self):
        """Row 6 (index 6) has three teams: Bonny Eagle (home) vs Deering + Portland."""
        html = _load("dashboard_schedule.html")
        data = parse_dashboard(html)
        # Find the Bonny Eagle game
        bonny_game = None
        for g in data["today"]:
            if g["home"] == "Bonny Eagle":
                bonny_game = g
                break
        assert bonny_game is not None
        assert len(bonny_game["teams"]) == 3
