"""MPA.cc sport configuration and ID mappings."""

MPA_BASE = "https://www.mpa.cc"
MILESPLIT_BASE = "https://me.milesplit.com"

# MileSplit meet URLs to scrape for athlete results.
# These are populated manually or discovered from the MileSplit results page.
# Format: full URL to meet results page.
MILESPLIT_MEETS: list[str] = [
    # Add meet URLs here as they become available, e.g.:
    # "https://me.milesplit.com/meets/738421-8am-biddeford-freeport-cape-greely-2026/results",
    # "https://me.milesplit.com/meets/727592-class-a-state-meet-2026/results",
]

# TournamentIDs for sport info pages
SPORTS = {
    "winter": [
        {"sport": "Basketball", "gender": "Boys", "tournament_id": 100, "schedule_id": 2},
        {"sport": "Basketball", "gender": "Girls", "tournament_id": 101, "schedule_id": 3},
        {"sport": "Ice Hockey", "gender": "Boys", "tournament_id": 103, "schedule_id": 4},
        {"sport": "Ice Hockey", "gender": "Girls", "tournament_id": 108, "schedule_id": 5},
        {"sport": "Indoor Track", "gender": "Boys", "tournament_id": 104, "schedule_id": 24},
        {"sport": "Indoor Track", "gender": "Girls", "tournament_id": 300, "schedule_id": 17},
        {"sport": "Swimming", "gender": "Boys", "tournament_id": 105, "schedule_id": 22},
        {"sport": "Swimming", "gender": "Girls", "tournament_id": 7, "schedule_id": 23},
        {"sport": "Wrestling", "gender": "Coed", "tournament_id": 106, "schedule_id": 29},
        {"sport": "Nordic Ski", "gender": "Coed", "tournament_id": 402, "schedule_id": 47},
        {"sport": "Alpine Ski", "gender": "Boys", "tournament_id": 403, "schedule_id": 34},
        {"sport": "Alpine Ski", "gender": "Girls", "tournament_id": 404, "schedule_id": 35},
    ],
    "spring": [
        {"sport": "Baseball", "gender": "Boys", "tournament_id": 200, "schedule_id": 7},
        {"sport": "Softball", "gender": "Girls", "tournament_id": 205, "schedule_id": 12},
        {"sport": "Lacrosse", "gender": "Boys", "tournament_id": 202, "schedule_id": 8},
        {"sport": "Lacrosse", "gender": "Girls", "tournament_id": 203, "schedule_id": 9},
        {"sport": "Outdoor Track", "gender": "Boys", "tournament_id": 204, "schedule_id": 10},
        {"sport": "Outdoor Track", "gender": "Girls", "tournament_id": 301, "schedule_id": 11},
        {"sport": "Tennis", "gender": "Boys", "tournament_id": 206, "schedule_id": 13},
        {"sport": "Tennis", "gender": "Girls", "tournament_id": 207, "schedule_id": 14},
    ],
    "fall": [
        {"sport": "Cross Country", "gender": "Boys", "tournament_id": 1, "schedule_id": 18},
        {"sport": "Cross Country", "gender": "Girls", "tournament_id": 9, "schedule_id": 19},
        {"sport": "Field Hockey", "gender": "Girls", "tournament_id": 2, "schedule_id": 20},
        {"sport": "Football", "gender": "Boys", "tournament_id": 3, "schedule_id": 15},
        {"sport": "Golf", "gender": "Coed", "tournament_id": 4, "schedule_id": 28},
        {"sport": "Soccer", "gender": "Boys", "tournament_id": 5, "schedule_id": 21},
        {"sport": "Soccer", "gender": "Girls", "tournament_id": 6, "schedule_id": 16},
        {"sport": "Volleyball", "gender": "Girls", "tournament_id": 8, "schedule_id": 30},
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
