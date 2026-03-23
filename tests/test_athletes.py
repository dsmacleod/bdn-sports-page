"""Tests for the athletes scraper (MileSplit meet results parser)."""

import os

from scraper.athletes import (
    parse_meet_results,
    aggregate_athletes,
    _infer_gender,
    _clean_event_name,
    _extract_mark,
    _extract_place,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(filename: str) -> str:
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


# ---------------------------------------------------------------------------
# Unit tests for helpers
# ---------------------------------------------------------------------------


class TestInferGender:
    def test_girls(self):
        assert _infer_gender("Girls 800m") == "Girls"

    def test_boys(self):
        assert _infer_gender("Boys Shot Put") == "Boys"

    def test_unknown(self):
        assert _infer_gender("4x400m Relay") == ""


class TestCleanEventName:
    def test_removes_gender_prefix(self):
        assert _clean_event_name("Boys 100m") == "100m"
        assert _clean_event_name("Girls 3200m") == "3200m"

    def test_no_prefix(self):
        assert _clean_event_name("Long Jump") == "Long Jump"


class TestExtractMark:
    def test_time(self):
        assert _extract_mark(["1", "Doe", "School", "2:15.30"]) == "2:15.30"

    def test_time_minutes(self):
        assert _extract_mark(["1", "Doe", "9:45.22"]) == "9:45.22"

    def test_no_mark(self):
        assert _extract_mark(["1", "Doe", "School"]) == ""


class TestExtractPlace:
    def test_numeric(self):
        assert _extract_place(["1", "Name"]) == 1
        assert _extract_place(["12", "Name"]) == 12

    def test_with_dot(self):
        assert _extract_place(["3.", "Name"]) == 3

    def test_non_numeric(self):
        assert _extract_place(["Name", "School"]) == 0


# ---------------------------------------------------------------------------
# Parse meet results from HTML
# ---------------------------------------------------------------------------


class TestParseMeetResults:
    def test_table_based_results(self):
        html = """
        <html><body>
        <h3>Girls 800m</h3>
        <table>
          <tr><th>Pl</th><th>Name</th><th>School</th><th>Time</th></tr>
          <tr><td>1</td><td><a href="#">Jane Doe</a></td><td>Bangor</td><td>2:15.30</td></tr>
          <tr><td>2</td><td><a href="#">Mary Smith</a></td><td>Portland</td><td>2:18.44</td></tr>
        </table>
        </body></html>
        """
        results = parse_meet_results(html, meet_name="Test Meet", meet_date="2026-03-15")
        assert len(results) == 2
        assert results[0]["name"] == "Jane Doe"
        assert results[0]["school"] == "Bangor"
        assert results[0]["mark"] == "2:15.30"
        assert results[0]["place"] == 1
        assert results[0]["gender"] == "Girls"
        assert results[0]["event"] == "800m"
        assert results[0]["meet"] == "Test Meet"

    def test_empty_html(self):
        results = parse_meet_results("<html><body></body></html>")
        assert results == []

    def test_no_marks_skipped(self):
        html = """
        <html><body>
        <h3>Boys 100m</h3>
        <table>
          <tr><td>1</td><td>John</td><td>School</td></tr>
        </table>
        </body></html>
        """
        results = parse_meet_results(html)
        assert results == []


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


class TestAggregateAthletes:
    def test_groups_by_athlete(self):
        results = [
            {"name": "Jane Doe", "school": "Bangor", "gender": "Girls",
             "event": "800m", "mark": "2:15.30", "place": 1, "meet": "Meet A", "date": "2026-03-15"},
            {"name": "Jane Doe", "school": "Bangor", "gender": "Girls",
             "event": "1600m", "mark": "5:12.44", "place": 2, "meet": "Meet A", "date": "2026-03-15"},
            {"name": "John Smith", "school": "Portland", "gender": "Boys",
             "event": "100m", "mark": "11.22", "place": 1, "meet": "Meet A", "date": "2026-03-15"},
        ]
        athletes = aggregate_athletes(results)
        assert len(athletes) == 2
        jane = next(a for a in athletes if a["name"] == "Jane Doe")
        assert len(jane["events"]) == 2
        assert jane["school"] == "Bangor"

    def test_empty_input(self):
        assert aggregate_athletes([]) == []

    def test_same_name_different_school(self):
        results = [
            {"name": "Jane Doe", "school": "Bangor", "gender": "Girls",
             "event": "800m", "mark": "2:15.30", "place": 1, "meet": "M", "date": ""},
            {"name": "Jane Doe", "school": "Portland", "gender": "Girls",
             "event": "800m", "mark": "2:20.00", "place": 2, "meet": "M", "date": ""},
        ]
        athletes = aggregate_athletes(results)
        assert len(athletes) == 2
