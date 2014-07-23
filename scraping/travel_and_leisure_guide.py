import re
import urlparse

from dateutil import parser as date_parser
from dateutil import tz

import article_parser
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none


class TravelAndLeisureGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.travelandleisure\.com/trips/[^?]+).*')

    TITLE_XPATH = './/h1[@class="trip"]'

    ALLOW_ENTITY_SCRAPING = True

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@class="dek"]/p')[0])

    @fail_returns_none
    def get_content_date_datetime(self):
        date_text_line = html_parsing.tostring(
            self.root.xpath('.//div[contains(@class, "inspied-by")]')[0])
        # Looks like 'blah, Published May. 2007'
        date_text = date_text_line.split('Published')[1].strip()
        return date_parser.parse(date_text).replace(day=1, tzinfo=tz.tzutc())
