"""Tests for scraper.featured -- BDN RSS feed sports article parser."""

from scraper.featured import parse_rss_feed

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Bangor Daily News</title>
    <item>
      <title>Bangor rolls past Brewer</title>
      <link>https://bangordailynews.com/2026/03/03/sports/bangor-brewer</link>
      <dc:creator>Larry Mahoney</dc:creator>
      <category>Sports</category>
      <media:content url="https://img.bdn.com/photo.jpg" />
    </item>
    <item>
      <title>Legislature debates budget</title>
      <link>https://bangordailynews.com/2026/03/03/politics/budget</link>
      <dc:creator>Jessica Piper</dc:creator>
      <category>Politics</category>
    </item>
    <item>
      <title>Greely wins Class A tennis title</title>
      <link>https://bangordailynews.com/2026/03/03/sports/tennis</link>
      <dc:creator>Emily Burnham</dc:creator>
      <category>High School Sports</category>
    </item>
  </channel>
</rss>"""


class TestParseRssFeed:
    """Tests for parse_rss_feed()."""

    def test_parse_rss_returns_list(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        assert isinstance(articles, list)

    def test_filters_to_sports_only(self):
        """Should return 2 articles (Sports + High School Sports, not Politics)."""
        articles = parse_rss_feed(SAMPLE_RSS)
        assert len(articles) == 2
        titles = [a["title"] for a in articles]
        assert "Bangor rolls past Brewer" in titles
        assert "Greely wins Class A tennis title" in titles
        assert "Legislature debates budget" not in titles

    def test_article_has_required_fields(self):
        """Each article dict must have title, url, and byline."""
        articles = parse_rss_feed(SAMPLE_RSS)
        for article in articles:
            for field in ("title", "url", "byline"):
                assert field in article, f"Missing field: {field}"

    def test_article_values(self):
        """Verify the first sports article has correct field values."""
        articles = parse_rss_feed(SAMPLE_RSS)
        first = articles[0]
        assert first["title"] == "Bangor rolls past Brewer"
        assert first["url"] == "https://bangordailynews.com/2026/03/03/sports/bangor-brewer"
        assert first["byline"] == "Larry Mahoney"

    def test_image_extracted_from_media_content(self):
        """Articles with media:content should have an image URL."""
        articles = parse_rss_feed(SAMPLE_RSS)
        first = articles[0]
        assert first["image"] == "https://img.bdn.com/photo.jpg"

    def test_missing_image_returns_empty_string(self):
        """Articles without media:content should have an empty image string."""
        articles = parse_rss_feed(SAMPLE_RSS)
        # The second sports article (Greely) has no media:content
        greely = [a for a in articles if "Greely" in a["title"]][0]
        assert greely["image"] == ""

    def test_empty_feed_returns_empty_list(self):
        empty_rss = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Empty</title></channel></rss>"""
        articles = parse_rss_feed(empty_rss)
        assert articles == []

    def test_case_insensitive_category_matching(self):
        """Category matching should be case-insensitive."""
        rss_with_caps = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel>
            <item>
              <title>Test article</title>
              <link>https://example.com/test</link>
              <dc:creator>Author</dc:creator>
              <category>SPORTS</category>
            </item>
          </channel>
        </rss>"""
        articles = parse_rss_feed(rss_with_caps)
        assert len(articles) == 1

    def test_college_and_pro_sports_matched(self):
        """College Sports and Pro Sports categories should also match."""
        rss_multi = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel>
            <item>
              <title>UMaine wins</title>
              <link>https://example.com/umaine</link>
              <dc:creator>Writer A</dc:creator>
              <category>College Sports</category>
            </item>
            <item>
              <title>Patriots lose</title>
              <link>https://example.com/pats</link>
              <dc:creator>Writer B</dc:creator>
              <category>Pro Sports</category>
            </item>
          </channel>
        </rss>"""
        articles = parse_rss_feed(rss_multi)
        assert len(articles) == 2
