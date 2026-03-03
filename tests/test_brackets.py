"""Tests for scraper.brackets — MPA tournament bracket parser."""

import os

from scraper.brackets import is_tournament_active, parse_brackets

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(filename: str) -> str:
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


# ---------------------------------------------------------------------------
# is_tournament_active tests
# ---------------------------------------------------------------------------


class TestIsTournamentActive:
    """Tests for the is_tournament_active function."""

    def test_is_tournament_active_returns_bool(self):
        html = _load("brackets.html")
        result = is_tournament_active(html)
        assert isinstance(result, bool)

    def test_active_fixture_returns_true(self):
        """The fixture has bracket data, so it should return True."""
        html = _load("brackets.html")
        assert is_tournament_active(html) is True

    def test_empty_html_returns_false(self):
        assert is_tournament_active("<html><body></body></html>") is False

    def test_page_without_games_returns_false(self):
        """A page with the wrapper but no games should return False."""
        html = """
        <html><body>
        <div id="TournamentWrapperPanel">
            <p>No brackets available</p>
        </div>
        </body></html>
        """
        assert is_tournament_active(html) is False


# ---------------------------------------------------------------------------
# parse_brackets tests
# ---------------------------------------------------------------------------


class TestParseBrackets:
    """Tests for the parse_brackets function."""

    def test_parse_brackets_returns_list(self):
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        assert isinstance(brackets, list)
        assert len(brackets) > 0

    def test_bracket_round_has_class_name_and_matchups(self):
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        for b in brackets:
            assert "class_name" in b
            assert "matchups" in b
            assert isinstance(b["class_name"], str)
            assert isinstance(b["matchups"], list)

    def test_bracket_matchup_has_teams(self):
        """Each matchup should have team1 and team2 with non-empty names."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        for b in brackets:
            for m in b["matchups"]:
                assert "team1" in m
                assert "team2" in m
                assert m["team1"], f"team1 is empty in {b['class_name']}"
                assert m["team2"], f"team2 is empty in {b['class_name']}"

    def test_bracket_matchup_has_scores(self):
        """Each matchup should have score1 and score2."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        for b in brackets:
            for m in b["matchups"]:
                assert "score1" in m
                assert "score2" in m

    def test_bracket_matchup_has_seeds(self):
        """Each matchup should have seed1 and seed2."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        for b in brackets:
            for m in b["matchups"]:
                assert "seed1" in m
                assert "seed2" in m

    def test_five_rounds_in_fixture(self):
        """The fixture should have 5 rounds: Preliminary, Quarterfinal,
        Semifinal, Regional Final, State Final."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        assert len(brackets) == 5
        round_names = [b["class_name"] for b in brackets]
        assert "Preliminary Round" in round_names
        assert "Quarterfinal" in round_names
        assert "Semifinal" in round_names
        assert "Regional Final" in round_names
        assert "State Final" in round_names

    def test_preliminary_round_game_count(self):
        """The Preliminary Round should have 3 matchups."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        prelim = [b for b in brackets if b["class_name"] == "Preliminary Round"]
        assert len(prelim) == 1
        assert len(prelim[0]["matchups"]) == 3

    def test_quarterfinal_game_count(self):
        """The Quarterfinal should have 8 matchups (4 per region)."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        qf = [b for b in brackets if b["class_name"] == "Quarterfinal"]
        assert len(qf) == 1
        assert len(qf[0]["matchups"]) == 8

    def test_state_final_game_count(self):
        """The State Final should have 1 matchup."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        sf = [b for b in brackets if b["class_name"] == "State Final"]
        assert len(sf) == 1
        assert len(sf[0]["matchups"]) == 1

    def test_first_preliminary_game_values(self):
        """Verify the first preliminary game matches fixture data."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        prelim = [b for b in brackets if b["class_name"] == "Preliminary Round"][0]
        first = prelim["matchups"][0]
        assert first["team1"] == "Scarborough"
        assert first["team2"] == "Kennebunk"
        assert first["seed1"] == "8"
        assert first["seed2"] == "9"
        assert first["score1"] == "50"
        assert first["score2"] == "44"

    def test_state_final_game_values(self):
        """Verify the state final game matches fixture data."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        final = [b for b in brackets if b["class_name"] == "State Final"][0]
        game = final["matchups"][0]
        assert game["team1"] == "Camden Hills Regional"
        assert game["team2"] == "Portland"
        assert game["score1"] == "60"
        assert game["score2"] == "76"

    def test_matchup_has_header(self):
        """Each matchup should include a header with date/time/venue."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        first_game = brackets[0]["matchups"][0]
        assert "header" in first_game
        assert first_game["header"]  # non-empty

    def test_total_matchup_count(self):
        """Total matchups should be 3+8+4+2+1 = 18."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        total = sum(len(b["matchups"]) for b in brackets)
        assert total == 18

    def test_empty_html_returns_empty_list(self):
        brackets = parse_brackets("<html><body></body></html>")
        assert brackets == []

    def test_winner_team_name_not_empty(self):
        """Ensure winner names (in <b> tags) are extracted correctly."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        # Game 1 of qualifying: Bonny Eagle won (in <b>)
        prelim = [b for b in brackets if b["class_name"] == "Preliminary Round"][0]
        game2 = prelim["matchups"][1]
        assert game2["team2"] == "Bonny Eagle"  # winner, was in <b>
        assert game2["team1"] == "Westbrook"  # loser, bare text

    def test_loser_team_name_not_empty(self):
        """Ensure loser names (bare text nodes) are extracted correctly."""
        html = _load("brackets.html")
        brackets = parse_brackets(html)
        qf = [b for b in brackets if b["class_name"] == "Quarterfinal"][0]
        # Game 0: Camden Hills beat Skowhegan Area
        game = qf["matchups"][0]
        assert game["team1"] == "Camden Hills Regional"
        assert game["team2"] == "Skowhegan Area"
