"""MPA.cc sport configuration and ID mappings."""

MPA_BASE = "https://www.mpa.cc"

# TournamentIDs for sport info pages
SPORTS = {
    "winter": [
        {"sport": "Basketball", "gender": "Boys", "tournament_id": 100},
        {"sport": "Basketball", "gender": "Girls", "tournament_id": 101},
        {"sport": "Ice Hockey", "gender": "Boys", "tournament_id": 103},
        {"sport": "Ice Hockey", "gender": "Girls", "tournament_id": 108},
        {"sport": "Indoor Track", "gender": "Boys", "tournament_id": 104},
        {"sport": "Indoor Track", "gender": "Girls", "tournament_id": 300},
        {"sport": "Swimming", "gender": "Boys", "tournament_id": 105},
        {"sport": "Swimming", "gender": "Girls", "tournament_id": 7},
        {"sport": "Wrestling", "gender": "Coed", "tournament_id": 106},
        {"sport": "Nordic Ski", "gender": "Coed", "tournament_id": 402},
        {"sport": "Alpine Ski", "gender": "Boys", "tournament_id": 403},
        {"sport": "Alpine Ski", "gender": "Girls", "tournament_id": 404},
    ],
    "spring": [
        {"sport": "Baseball", "gender": "Boys", "tournament_id": 200},
        {"sport": "Softball", "gender": "Girls", "tournament_id": 205},
        {"sport": "Lacrosse", "gender": "Boys", "tournament_id": 202},
        {"sport": "Lacrosse", "gender": "Girls", "tournament_id": 203},
        {"sport": "Outdoor Track", "gender": "Boys", "tournament_id": 204},
        {"sport": "Outdoor Track", "gender": "Girls", "tournament_id": 301},
        {"sport": "Tennis", "gender": "Boys", "tournament_id": 206},
        {"sport": "Tennis", "gender": "Girls", "tournament_id": 207},
    ],
    "fall": [
        {"sport": "Cross Country", "gender": "Boys", "tournament_id": 1},
        {"sport": "Cross Country", "gender": "Girls", "tournament_id": 9},
        {"sport": "Field Hockey", "gender": "Girls", "tournament_id": 2},
        {"sport": "Football", "gender": "Boys", "tournament_id": 3},
        {"sport": "Golf", "gender": "Coed", "tournament_id": 4},
        {"sport": "Soccer", "gender": "Boys", "tournament_id": 5},
        {"sport": "Soccer", "gender": "Girls", "tournament_id": 6},
        {"sport": "Volleyball", "gender": "Girls", "tournament_id": 8},
    ],
}


def current_season(month):
    """Return the current sports season based on month number."""
    if month in (12, 1, 2, 3):
        return "winter"
    elif month in (4, 5, 6):
        return "spring"
    else:
        return "fall"
