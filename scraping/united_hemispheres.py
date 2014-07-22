import re

import article_parser
from scraping import html_parsing

class UnitedHemispheres(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.hemispheresmagazine\.com/\d+/\d+/\d+/[^/]+/).*')

    TITLE_XPATH = './/div[@id="Content"]//h2'
    COVER_IMAGE_URL_XPATH = './/div[@id="copy"]//img/@src'

    def get_location_name(self):
        if 'Three Perfect Days:' in self.get_title():
            return self.get_title().replace('Three Perfect Days:', '').strip()
        return None

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@class="excerpt"]/p')[0])
