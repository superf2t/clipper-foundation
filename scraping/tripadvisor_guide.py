import re

import article_parser
import data
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none

class TripAdvisorGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.tripadvisor\.com/Guide-.+\.html).*')

    TITLE_XPATH = './/h1[@id="HEADING"]'
    COVER_IMAGE_URL_XPATH = './/div[contains(@class, "guideOverview")]//img/@src'

    ALLOW_ENTITY_SCRAPING = True

    def get_location_name(self):
        page_header_node = self.root.xpath('.//h1[contains(@class, "header")]')
        if page_header_node:
            page_header = html_parsing.tostring(page_header_node[0])
            if 'Travel Guide for' in page_header:
                return page_header.replace('Travel Guide for ', '')
        return None

    @fail_returns_none
    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@class="guideDescription"]')[0])

    @fail_returns_none
    def get_entity_overrides(self):
        overrides = {}
        current_day = 0
        for node in self.root.xpath(
            './/div[@id="GUIDE_DETAIL"]//div[contains(@class, "guideOverview")]')[0].itersiblings():
            if node.tag == 'h5':
                current_day = int(node.text.replace('Day', '').strip())
            elif node.tag == 'div':
                tags = [data.Tag(text='Day %d' % current_day)]

                desc = None
                # Items with long descriptions on the entity page will not have 'shortDesc',
                # node, they'll have an untagged <p> tagged that contains a 'more' link.
                desc_nodes = node.xpath('.//p[contains(@id, "shortDesc")]')
                if desc_nodes:
                    desc = html_parsing.tostring(desc_nodes[0])

                rel_source_url = node.xpath('div[@class="guideItemInfo"]//a[@class="titleLink"]/@href')[0]
                overrides[self.absolute_url(rel_source_url)] = data.Entity(tags=tags, description=desc)

        return overrides
