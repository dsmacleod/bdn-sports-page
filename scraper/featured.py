"""Parse BDN's Sports category RSS feed for the latest stories strip.

Pulls from the Sports category feed directly (BDN_SPORTS_FEED_URL) rather
than the site-wide feed filtered by <category> tag: the site-wide feed is
just the newest N articles across the whole paper, so on a busy news day
sports stories can get crowded out and never appear at all, even if they
were tagged correctly. The category feed is the actual Sports section --
every story published there, in order, nothing else.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

_NS = {
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

BDN_SPORTS_FEED_URL = "https://www.bangordailynews.com/category/sports/feed/"

_IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"')


def _first_image(html: str) -> str:
    """Pull the first <img src> out of the item's HTML body. The Sports feed
    doesn't carry a <media:content> element (unlike the site-wide feed) --
    the lead image is just embedded in the description/content:encoded HTML."""
    if not html:
        return ""
    m = _IMG_SRC_RE.search(html)
    return m.group(1) if m else ""


def parse_rss_feed(xml_text: str) -> list[dict]:
    """Parse the Sports category feed into article dicts.

    Returns a list of dicts with keys: title, url, byline, image, pub_date
    (RFC 2822 string as given, e.g. "Fri, 18 Sep 2026 20:36:10 +0000" -- the
    front end formats/relative-izes it, same as it already does for game
    dates), in the feed's own order (newest first).
    """
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []

    articles: list[dict] = []
    for item in channel.findall("item"):
        title_el = item.find("title")
        link_el = item.find("link")
        creator_el = item.find("dc:creator", _NS)
        pub_date_el = item.find("pubDate")
        content_el = item.find("content:encoded", _NS)
        description_el = item.find("description")

        html = ""
        if content_el is not None and content_el.text:
            html = content_el.text
        elif description_el is not None and description_el.text:
            html = description_el.text

        articles.append({
            "title": (title_el.text or "").strip() if title_el is not None else "",
            "url": (link_el.text or "").strip() if link_el is not None else "",
            "byline": (creator_el.text or "").strip() if creator_el is not None else "",
            "image": _first_image(html),
            "pub_date": (pub_date_el.text or "").strip() if pub_date_el is not None else "",
        })

    return articles


def fetch_featured(session, max_articles: int = 20) -> list[dict]:
    """Fetch the latest Sports-section articles.

    Args:
        session: A ``requests.Session`` (or compatible) with headers set.
        max_articles: Maximum number of articles to return. The feed itself
            only ever returns its own page size (WordPress default 20), so
            this just caps how many of those we keep.

    Returns:
        List of article dicts (up to *max_articles*), newest first.
    """
    resp = session.get(BDN_SPORTS_FEED_URL, timeout=30)
    resp.raise_for_status()
    articles = parse_rss_feed(resp.text)
    return articles[:max_articles]
