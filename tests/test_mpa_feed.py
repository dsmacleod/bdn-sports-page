"""Tests for scraper.mpa_feed -- MPA xmlgamesync.ashx parser."""

import os

from scraper.mpa_feed import parse_gamesync, filter_games

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(filename: str) -> str:
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


class TestParseGamesync:
    def test_returns_list_of_all_events(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        assert isinstance(games, list)
        assert len(games) == 5

    def test_required_fields_present(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        for field in ("game_id", "date", "time", "sport", "gender", "level",
                      "type", "status", "site", "teams"):
            assert field in games[0], f"Missing field: {field}"

    def test_sport_and_gender_split_from_parens(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        xc = next(g for g in games if g["game_id"] == "35658")
        assert xc["sport"] == "Cross Country"
        assert xc["gender"] == "Boys"

    def test_sport_without_gender_suffix(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        football = next(g for g in games if g["game_id"] == "50123")
        assert football["sport"] == "Football"
        assert football["gender"] == ""

    def test_two_team_game_gets_home_away_convenience_fields(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        fh = next(g for g in games if g["game_id"] == "59974")
        assert fh["home"] == "Central"
        assert fh["away"] == "Stearns Sr."

    def test_completed_game_has_scores_and_results(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        fh = next(g for g in games if g["game_id"] == "59974")
        assert fh["home_score"] == 1
        assert fh["away_score"] == 12
        results = {t["school"]: t["result"] for t in fh["teams"]}
        assert results["Central"] == "Loss"
        assert results["Stearns Sr."] == "Win"

    def test_scheduled_game_has_no_score_fields(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        xc = next(g for g in games if g["game_id"] == "35658")
        assert "home_score" not in xc
        assert all(t["score"] is None for t in xc["teams"])

    def test_multi_team_event_keeps_full_team_list_no_home_away_shortcut(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        golf = next(g for g in games if g["game_id"] == "40975")
        assert len(golf["teams"]) == 1
        assert "home" not in golf  # convenience fields only added for 2-team events

    def test_postponed_status_and_time(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        postponed = next(g for g in games if g["game_id"] == "40451")
        assert postponed["status"] == "Postponed"
        assert postponed["time"] == "Postponed"

    def test_tournament_type(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        golf = next(g for g in games if g["game_id"] == "40975")
        assert golf["type"] == "Tournament"


class TestFilterGames:
    def test_filter_by_sport_case_insensitive(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        football = filter_games(games, sport="football")
        assert len(football) == 1
        assert football[0]["game_id"] == "50123"

    def test_filter_by_since_date(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        recent = filter_games(games, since="2026-09-13")
        dates = {g["game_id"] for g in recent}
        assert dates == {"59974", "40975"}

    def test_filter_by_school_substring(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        bangor_games = filter_games(games, school="bangor")
        assert len(bangor_games) == 1
        assert bangor_games[0]["game_id"] == "50123"

    def test_filters_combine(self):
        games = parse_gamesync(_load("mpa_gamesync.xml"))
        result = filter_games(games, sport="Field Hockey", since="2026-09-01")
        assert len(result) == 1
        assert result[0]["game_id"] == "59974"
