import re
import urlparse

from dateutil import parser as date_parser
from dateutil import tz

import article_parser
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none


class ZagatGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.zagat\.com/l/.+/.+)')

    TITLE_XPATH = './/h1[@itemprop="name"]'

    ALLOW_ENTITY_SCRAPING = True

    def get_location_name(self):
        return urlparse.urlparse(self.url).path.split('/')[2].replace('-', ' ')

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@itemprop="description"]')[0])

    @fail_returns_none
    def get_content_date_datetime(self):
        date_text = html_parsing.tostring(
            self.root.xpath('.//span[@itemprop="datePublished"]')[0])
        return date_parser.parse(date_text).replace(tzinfo=tz.tzutc())
