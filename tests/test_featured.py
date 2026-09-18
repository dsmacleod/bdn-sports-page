"""Tests for scraper.featured -- BDN Sports category RSS feed parser."""

from scraper.featured import parse_rss_feed

# Modeled on the real https://www.bangordailynews.com/category/sports/feed/
# response: no <media:content>, the lead image lives inside <content:encoded>
# as a plain <img> tag, and every item is already a Sports-section story --
# there's no <category> filtering to do, unlike the old site-wide-feed
# approach this replaced.
SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Bangor Daily News</title>
    <item>
      <title>Boston Bruins, UMaine hockey alums to square off in charity game</title>
      <link>https://www.bangordailynews.com/2026/09/18/sports/college-ice-hockey/boston-bruins-umaine/</link>
      <dc:creator>Larry Mahoney</dc:creator>
      <pubDate>Fri, 18 Sep 2026 20:36:10 +0000</pubDate>
      <category>College Ice Hockey</category>
      <category>Sports</category>
      <content:encoded><![CDATA[<figure><img width="1024" height="595" src="https://i0.wp.com/bdn-data.s3.amazonaws.com/photo.jpg" /></figure><p>Story text here.</p>]]></content:encoded>
    </item>
    <item>
      <title>UMaine football looking to get its sluggish offense on track at BC</title>
      <link>https://www.bangordailynews.com/2026/09/18/sports/college-football/umaine-bc/</link>
      <dc:creator>Larry Mahoney</dc:creator>
      <pubDate>Fri, 18 Sep 2026 18:12:00 +0000</pubDate>
      <category>College Football</category>
      <category>Sports</category>
      <content:encoded><![CDATA[<p>No image on this one, just text.</p>]]></content:encoded>
    </item>
  </channel>
</rss>"""


class TestParseRssFeed:
    """Tests for parse_rss_feed()."""

    def test_parse_rss_returns_list(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        assert isinstance(articles, list)

    def test_returns_every_item_no_filtering(self):
        """The Sports category feed is already fully scoped -- every item
        it returns should come through, with nothing dropped."""
        articles = parse_rss_feed(SAMPLE_RSS)
        assert len(articles) == 2

    def test_article_has_required_fields(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        for article in articles:
            for field in ("title", "url", "byline", "image", "pub_date"):
                assert field in article, f"Missing field: {field}"

    def test_article_values(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        first = articles[0]
        assert first["title"] == "Boston Bruins, UMaine hockey alums to square off in charity game"
        assert first["url"] == "https://www.bangordailynews.com/2026/09/18/sports/college-ice-hockey/boston-bruins-umaine/"
        assert first["byline"] == "Larry Mahoney"
        assert first["pub_date"] == "Fri, 18 Sep 2026 20:36:10 +0000"

    def test_image_extracted_from_content_encoded_html(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        assert articles[0]["image"] == "https://i0.wp.com/bdn-data.s3.amazonaws.com/photo.jpg"

    def test_missing_image_returns_empty_string(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        assert articles[1]["image"] == ""

    def test_preserves_feed_order_newest_first(self):
        articles = parse_rss_feed(SAMPLE_RSS)
        assert articles[0]["pub_date"] > articles[1]["pub_date"]

    def test_empty_feed_returns_empty_list(self):
        empty_rss = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Empty</title></channel></rss>"""
        articles = parse_rss_feed(empty_rss)
        assert articles == []
