import json
import re

from lxml import etree

import article_parser
import data
from scraping import html_parsing
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none

class RickStevesGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.ricksteves\.com/europe/[^/]+/[^/]+)')

    TITLE_XPATH = './/h1'
    COVER_IMAGE_URL_XPATH = './/li[contains(@class, "slide")]//img/@src'

    @fail_returns_none
    def get_location_name(self):
        return self.get_title()

    @fail_returns_none
    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//h1/following-sibling::div')[0])

    @fail_returns_empty
    def get_raw_entities(self):
        entities = []
        items = self.root.xpath('.//h2[@class="accordion-title" and contains(., "At a Glance")]/following-sibling::div//p')
        for item in items:
            num_stars = len(item.text.strip())
            starred = num_stars == 3
            name = item.xpath('.//strong')[0].text.strip()
            temp_html = re.sub('<strong>.*</strong>', 'SPLIT_POINT', etree.tostring(item))
            temp_node = html_parsing.parse_tree_from_string(temp_html.encode('utf-8'))
            desc = html_parsing.tostring(temp_node).split('SPLIT_POINT')[1].strip()
            entities.append(data.Entity(name=name, starred=starred, description=desc))
        return entities
