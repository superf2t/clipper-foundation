import re

import article_parser
import data
from scraping import html_parsing

class Nytimes36HoursOld(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.nytimes\.com/(?=(?!2014))\d+/\d+/\d+/travel/.+hours.*\.html).*')

    TITLE_XPATH = './/h1[@itemprop="headline"]'
    COVER_IMAGE_URL_XPATH = './/div[@class="articleSpanImage"]//img/@src'

    def get_location_name(self):
        if '36 Hours in' in self.get_title():
            return self.get_title().replace('36 Hours in ', '')
        return None

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@class="articleBody"]/p')[0])

    def get_raw_entities(self):
        return []

    @classmethod
    def canonicalize(cls, url):
        return cls.URL_REGEX.match(url).group(1)
