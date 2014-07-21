import re

import article_parser
import data
from scraping import html_parsing

class FrommersGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www.frommers.com/destinations/[^/]+/\d+).*$')    

    TITLE_XPATH = './/h1[contains(@class, "articleTitle")]'

    def get_location_name(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[contains(@class, "left-sidebar")]//h3')[0])

    def get_description(self):
        return None

    def get_raw_entities(self):
        return []

    @classmethod
    def canonicalize(cls, url):
        return cls.URL_REGEX.match(url).group(1)
