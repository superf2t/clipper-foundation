import re

from lxml import etree

import article_parser
import clip_logic
import data
from scraping import html_parsing

class TripAdvisorGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.tripadvisor\.com/Guide-.+\.html).*')

    TITLE_XPATH = './/h1[@id="HEADING"]'
    COVER_IMAGE_URL_XPATH = './/div[contains(@class, "guideOverview")]//img/@src'

    def get_location_name(self):
        page_header_node = self.root.xpath('.//h1[contains(@class, "header")]')
        if page_header_node:
            page_header = html_parsing.tostring(page_header_node[0])
            if 'Travel Guide for' in page_header:
                return page_header.replace('Travel Guide for ', '')
        return None

    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@class="guideDescription"]')[0])

    def get_raw_entities(self):
        return clip_logic.scrape_entities_from_url(self.url, page_source=etree.tostring(self.root))

    @classmethod
    def canonicalize(cls, url):
        return cls.URL_REGEX.match(url).group(1)
