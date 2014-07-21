import re

import article_parser
import data
from scraping import html_parsing

class FodorsGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.fodors\.com/world/.+/feature_\d+\.html).*$')

    TITLE_XPATH = './/h2[contains(@class, "dest-page")]'

    def get_location_name(self):
        return self.root.xpath('.//div[contains(@class, "main-content")]//h1/text()')[0]

    def get_description(self):
        return None

    def get_raw_entities(self):
        return []

    @classmethod
    def canonicalize(cls, url):
        return cls.URL_REGEX.match(url).group(1)
