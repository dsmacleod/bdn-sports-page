"""Sport/gender config and season calendar.

This used to also hold MPA.cc TournamentID/ScheduleID mappings for scraping
standings, brackets, and schedules directly off MPA.cc's site. That's gone:
MPA.cc's own page structure and ID numbering keep shifting under us (e.g. one
TournamentID we relied on quietly started serving a different sport's data
entirely this season), and that data isn't something BDN adds value by
re-hosting anyway -- MPA.cc already presents it. schedules/scores now come
exclusively from the official game sync feed (see mpa_feed.py); standings/
brackets are a plain link out to MPA.cc instead of a scrape.

What's left here is just the sport/gender list, used by mpa_feed.py to fill
in the gender the feed itself leaves blank for single-gender sports (see
mpa_feed._build_gender_fallback), and current_season() for the season tabs.
"""

SPORTS = {
    "winter": [
        {"sport": "Basketball", "gender": "Boys"},
        {"sport": "Basketball", "gender": "Girls"},
        {"sport": "Ice Hockey", "gender": "Boys"},
        {"sport": "Ice Hockey", "gender": "Girls"},
        {"sport": "Indoor Track", "gender": "Boys"},
        {"sport": "Indoor Track", "gender": "Girls"},
        {"sport": "Swimming", "gender": "Boys"},
        {"sport": "Swimming", "gender": "Girls"},
        {"sport": "Wrestling", "gender": "Coed"},
        {"sport": "Nordic Ski", "gender": "Coed"},
        {"sport": "Alpine Ski", "gender": "Boys"},
        {"sport": "Alpine Ski", "gender": "Girls"},
    ],
    "spring": [
        {"sport": "Baseball", "gender": "Boys"},
        {"sport": "Softball", "gender": "Girls"},
        {"sport": "Lacrosse", "gender": "Boys"},
        {"sport": "Lacrosse", "gender": "Girls"},
        {"sport": "Outdoor Track", "gender": "Boys"},
        {"sport": "Outdoor Track", "gender": "Girls"},
        {"sport": "Tennis", "gender": "Boys"},
        {"sport": "Tennis", "gender": "Girls"},
    ],
    "fall": [
        {"sport": "Cross Country", "gender": "Boys"},
        {"sport": "Cross Country", "gender": "Girls"},
        {"sport": "Field Hockey", "gender": "Girls"},
        {"sport": "Football", "gender": "Boys"},
        {"sport": "Golf", "gender": "Coed"},
        {"sport": "Soccer", "gender": "Boys"},
        {"sport": "Soccer", "gender": "Girls"},
        {"sport": "Volleyball", "gender": "Girls"},
    ],
}

# Official MPA game sync feed -- statewide, no server-side filtering (see
# mpa_feed.py), the only source used here now.
MPA_GAMESYNC_URL = "https://mpa.fpsports.org/services/xmlgamesync.ashx"

# Where to send readers for official standings/brackets instead of scraping
# them ourselves.
MPA_OFFICIAL_SITE_URL = "https://www.mpa.cc/"


def current_season(month):
    """Return the current sports season based on month number."""
    if month in (12, 1, 2, 3):
        return "winter"
    elif month in (4, 5, 6):
        return "spring"
    else:
        return "fall"
