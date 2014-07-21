import re

from lxml import etree

import article_parser
import clip_logic
import data
from scraping import html_parsing

class LonelyPlanetTopThings(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.lonelyplanet\.com/.+/things-to-do).*')

    TITLE_XPATH = './/h1'

    def get_location_name(self):
        if 'Things to do in' in self.get_title():
            return self.get_title().replace('Things to do in ', '')
        return None

    def get_raw_entities(self):
        return clip_logic.scrape_entities_from_url(self.url,
            page_source=etree.tostring(self.root), for_guide=True)

    @classmethod
    def canonicalize(cls, url):
        return cls.URL_REGEX.match(url).group(1)
