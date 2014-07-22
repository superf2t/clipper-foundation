import re

from dateutil import parser as date_parser
from dateutil import tz

import article_parser
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none

class BonAppetitGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.bonappetit\.com/restaurants-travel/[^?]+).*')

    TITLE_XPATH = './/h1'
    COVER_IMAGE_URL_XPATH = './/div[@class="start_overlay"]//img/@src'

    def get_location_name(self):
        if 'Where to Eat and Drink in' in self.get_title():
            return self.get_title().replace('Where to Eat and Drink in ', '').strip()
        return None

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[contains(@class, "intro_text")]//p')[0])

    @fail_returns_none
    def get_content_date_datetime(self):
        date_text_line = html_parsing.tostring(
            self.root.xpath('.//div[@class="top_meta"]//span[@class="date"]')[0])
        date_text = date_text_line.replace('Published on', '').strip()
        return date_parser.parse(date_text).replace(tzinfo=tz.tzutc())
