import re

import article_parser
import data
from scraping import html_parsing

class FodorsGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.fodors\.com/world/.+/feature_\d+\.html).*$')

    TITLE_XPATH = './/h2[contains(@class, "dest-page")]'

    def get_location_name(self):
        return self.root.xpath('.//div[contains(@class, "main-content")]//h1/text()')[0]
