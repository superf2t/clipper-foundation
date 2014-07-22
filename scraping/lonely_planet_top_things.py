import re

import article_parser

class LonelyPlanetTopThings(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.lonelyplanet\.com/.+/things-to-do).*')

    TITLE_XPATH = './/h1'

    ALLOW_ENTITY_SCRAPING = True

    def get_location_name(self):
        if 'Things to do in' in self.get_title():
            return self.get_title().replace('Things to do in ', '')
        return None
