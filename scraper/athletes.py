"""Scrape individual athlete results from Maine MileSplit meet pages."""

from __future__ import annotations

import re
import time

from bs4 import BeautifulSoup


def parse_meet_results(html: str, meet_name: str = "", meet_date: str = "") -> list[dict]:
    """Parse a MileSplit meet results page into individual athlete performances.

    Args:
        html: Raw HTML string from the meet results page.
        meet_name: Name of the meet (used as fallback if not in HTML).
        meet_date: Date string YYYY-MM-DD (used as fallback if not in HTML).

    Returns:
        List of dicts with keys: name, school, gender, event, mark, place, meet, date.
    """
    soup = BeautifulSoup(html, "lxml")
    results = []

    # MileSplit renders results in tables or divs with event headers.
    # Look for event sections with result rows.
    # Common patterns: tables with class containing "results", or divs with event headers.

    # Try table-based results first
    for table in soup.find_all("table"):
        event_name = _find_event_name(table)
        if not event_name:
            continue

        gender = _infer_gender(event_name)
        clean_event = _clean_event_name(event_name)

        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 3:
                continue

            result = _parse_result_row(cells, clean_event, gender, meet_name, meet_date)
            if result:
                results.append(result)

    # Try div-based results (alternate MileSplit layout)
    for section in soup.find_all("div", class_=re.compile(r"event|result", re.I)):
        event_header = section.find(re.compile(r"h[2-4]"))
        if not event_header:
            continue

        event_name = event_header.get_text(strip=True)
        gender = _infer_gender(event_name)
        clean_event = _clean_event_name(event_name)

        for row in section.find_all("div", class_=re.compile(r"row|athlete|entry", re.I)):
            result = _parse_div_result(row, clean_event, gender, meet_name, meet_date)
            if result:
                results.append(result)

    return results


def _find_event_name(table) -> str:
    """Find the event name associated with a results table."""
    # Check preceding sibling headers
    prev = table.find_previous_sibling(re.compile(r"h[2-4]"))
    if prev:
        return prev.get_text(strip=True)
    # Check caption
    caption = table.find("caption")
    if caption:
        return caption.get_text(strip=True)
    # Check thead for event name
    thead = table.find("thead")
    if thead:
        text = thead.get_text(strip=True)
        if any(kw in text.lower() for kw in ["meter", "mile", "relay", "jump", "throw", "shot", "discus", "hurdle"]):
            return text
    return ""


def _infer_gender(event_name: str) -> str:
    """Infer gender from event name text."""
    lower = event_name.lower()
    if "girls" in lower or "women" in lower or "female" in lower:
        return "Girls"
    if "boys" in lower or "men" in lower or "male" in lower:
        return "Boys"
    return ""


def _clean_event_name(event_name: str) -> str:
    """Remove gender prefix and clean up event name."""
    # Remove "Boys " or "Girls " prefix
    cleaned = re.sub(r"^(Boys|Girls|Men'?s?|Women'?s?)\s+", "", event_name, flags=re.I)
    return cleaned.strip()


def _parse_result_row(cells, event: str, gender: str, meet: str, date: str) -> dict | None:
    """Parse a table row into an athlete result dict."""
    texts = [c.get_text(strip=True) for c in cells]

    # Common layouts:
    # Place, Name, School, Mark
    # Place, Name, Grade, School, Mark
    # Try to identify place (numeric) and mark (time/distance pattern)
    place = _extract_place(texts)
    mark = _extract_mark(texts)
    name = ""
    school = ""

    if not mark:
        return None

    # Find name: usually the cell with a link or the cell after place
    for cell in cells:
        link = cell.find("a")
        if link and not name:
            name = link.get_text(strip=True)
            break

    if not name and len(texts) >= 2:
        # Name is typically second column
        name = texts[1] if not texts[1].replace(".", "").isdigit() else ""

    # Find school: look for a cell that's not the name, place, or mark
    for i, text in enumerate(texts):
        if text == name or text == str(place) or text == mark:
            continue
        if text and not text.replace(".", "").isdigit() and len(text) > 1:
            # Skip grade indicators
            if text in ("Fr", "So", "Jr", "Sr", "FR", "SO", "JR", "SR"):
                continue
            school = text
            break

    if not name:
        return None

    return {
        "name": name,
        "school": school,
        "gender": gender,
        "event": event,
        "mark": mark,
        "place": place,
        "meet": meet,
        "date": date,
    }


def _parse_div_result(row, event: str, gender: str, meet: str, date: str) -> dict | None:
    """Parse a div-based result row."""
    text = row.get_text(" ", strip=True)
    links = row.find_all("a")

    name = links[0].get_text(strip=True) if links else ""
    if not name:
        return None

    # Try to find school from second link or span
    school = links[1].get_text(strip=True) if len(links) > 1 else ""

    mark = _extract_mark_from_text(text)
    place = _extract_place_from_text(text)

    if not mark:
        return None

    return {
        "name": name,
        "school": school,
        "gender": gender,
        "event": event,
        "mark": mark,
        "place": place,
        "meet": meet,
        "date": date,
    }


# -- Mark/place extraction helpers --

_TIME_RE = re.compile(r"\b(\d{1,2}:\d{2}(?:\.\d{1,2})?)\b")
_DISTANCE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:m|ft|'|\")\b", re.I)
_MARK_RE = re.compile(r"\b(\d{1,2}:\d{2}(?:\.\d{1,2})?|\d+-\d{2}(?:\.\d{2})?|\d+'\s*\d+(?:\.\d+)?\"?)\b")


def _extract_mark(texts: list[str]) -> str:
    """Extract a time or distance mark from cell texts."""
    for text in reversed(texts):  # marks are usually in later columns
        m = _TIME_RE.search(text)
        if m:
            return m.group(1)
        m = _MARK_RE.search(text)
        if m:
            return m.group(1)
    return ""


def _extract_mark_from_text(text: str) -> str:
    """Extract a mark from a combined text string."""
    m = _TIME_RE.search(text)
    if m:
        return m.group(1)
    m = _MARK_RE.search(text)
    if m:
        return m.group(1)
    return ""


def _extract_place(texts: list[str]) -> int:
    """Extract placement number (usually first column)."""
    if texts:
        try:
            return int(texts[0].rstrip("."))
        except ValueError:
            pass
    return 0


def _extract_place_from_text(text: str) -> int:
    """Extract placement from combined text."""
    m = re.match(r"(\d+)\s", text)
    if m:
        return int(m.group(1))
    return 0


# -- Aggregation --

def aggregate_athletes(results: list[dict]) -> list[dict]:
    """Aggregate individual meet results into per-athlete records.

    Groups results by (name, school, gender, sport) and collects all
    event performances under each athlete.

    Returns list of athlete dicts matching the athletes.json schema.
    """
    athletes: dict[tuple, dict] = {}

    for r in results:
        key = (r["name"].lower(), r.get("school", "").lower(), r.get("gender", ""))
        if key not in athletes:
            athletes[key] = {
                "name": r["name"],
                "school": r.get("school", ""),
                "gender": r.get("gender", ""),
                "grade": "",
                "sport": _infer_sport(r.get("event", "")),
                "events": [],
            }

        athletes[key]["events"].append({
            "event": r["event"],
            "mark": r["mark"],
            "meet": r["meet"],
            "date": r["date"],
            "place": r["place"],
        })

    return list(athletes.values())


def _infer_sport(event_name: str) -> str:
    """Infer sport from event name."""
    lower = event_name.lower()
    xc_keywords = ["cross country", "5k", "5000m", "3 mile", "3mile"]
    if any(kw in lower for kw in xc_keywords):
        return "Cross Country"
    return "Track"


# -- Fetch --

def fetch_meet_results(session, meet_url: str) -> list[dict]:
    """Fetch and parse a single meet results page.

    Args:
        session: requests.Session with headers set.
        meet_url: Full URL to the meet results page.

    Returns:
        List of individual result dicts.
    """
    print(f"  Fetching meet: {meet_url}")
    resp = session.get(meet_url, timeout=30)
    resp.raise_for_status()

    # Extract meet name from URL slug
    slug_match = re.search(r"/meets/\d+-(.+?)(?:/|$)", meet_url)
    meet_name = slug_match.group(1).replace("-", " ").title() if slug_match else ""

    return parse_meet_results(resp.text, meet_name=meet_name)


def fetch_athletes(session, meet_urls: list[str], delay: float = 1.0) -> list[dict]:
    """Fetch results from multiple meets and aggregate into athlete records.

    Args:
        session: requests.Session with headers set.
        meet_urls: List of MileSplit meet result page URLs.
        delay: Seconds to wait between requests (rate limiting).

    Returns:
        List of aggregated athlete dicts ready for athletes.json.
    """
    all_results = []

    for i, url in enumerate(meet_urls):
        try:
            results = fetch_meet_results(session, url)
            all_results.extend(results)
            print(f"    Got {len(results)} results")
        except Exception as e:
            print(f"    Warning: failed to fetch {url}: {e}")

        if i < len(meet_urls) - 1:
            time.sleep(delay)

    return aggregate_athletes(all_results)
