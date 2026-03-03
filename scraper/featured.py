"""Parse BDN RSS feed for featured sports articles."""

from __future__ import annotations

import xml.etree.ElementTree as ET


# XML namespaces used in the BDN RSS feed
_NS = {
    "dc": "http://purl.org/dc/elements/1.1/",
    "media": "http://search.yahoo.com/mrss/",
}

# Categories that count as sports (compared case-insensitively)
_SPORTS_CATEGORIES = {
    "sports",
    "high school sports",
    "college sports",
    "pro sports",
}

BDN_FEED_URL = "https://www.bangordailynews.com/feed/"


def _is_sports_article(item: ET.Element) -> bool:
    """Check whether an RSS <item> has a sports-related category."""
    for cat in item.findall("category"):
        if cat.text and cat.text.strip().lower() in _SPORTS_CATEGORIES:
            return True
    return False


def parse_rss_feed(xml_text: str) -> list[dict]:
    """Parse RSS XML and return sports articles only.

    Filters to articles that have a sports-related <category> element.

    Returns:
        List of article dicts with keys: title, url, byline, image.
    """
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []

    articles: list[dict] = []
    for item in channel.findall("item"):
        if not _is_sports_article(item):
            continue

        title_el = item.find("title")
        link_el = item.find("link")
        creator_el = item.find("dc:creator", _NS)
        media_el = item.find("media:content", _NS)

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        url = link_el.text.strip() if link_el is not None and link_el.text else ""
        byline = creator_el.text.strip() if creator_el is not None and creator_el.text else ""
        image = media_el.get("url", "") if media_el is not None else ""

        articles.append({
            "title": title,
            "url": url,
            "byline": byline,
            "image": image,
        })

    return articles


def fetch_featured(session, max_articles: int = 4) -> list[dict]:
    """Fetch latest sports articles from the BDN RSS feed.

    Args:
        session: A ``requests.Session`` (or compatible) with headers set.
        max_articles: Maximum number of articles to return (default 4).

    Returns:
        List of article dicts (up to *max_articles*).
    """
    resp = session.get(BDN_FEED_URL, timeout=30)
    resp.raise_for_status()
    articles = parse_rss_feed(resp.text)
    return articles[:max_articles]
