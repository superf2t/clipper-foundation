import re

from dateutil import parser as date_parser
from dateutil import tz

import article_parser
import data
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none

import urlparse

class ThrillistGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.thrillist\.com/(?:eat|drink)/.+)')

    TITLE_XPATH = './/h1//span[@itemprop="headline"]'

    ALLOW_ENTITY_SCRAPING = True

    @fail_returns_none
    def get_cover_image_url(self):
        style = self.root.xpath('.//div[@itemprop="articleBody"]//div[@class="showcase"]//span[@class="desktop"]//span[@class="img"]/@style')[0]
        # Looks like background-image:url(//assets3.thrillist.com/v1/image/1145104/size/tl-horizontal_main)
        img_url = style.split(':')[1].strip()[4:-1]
        return self.absolute_url(img_url)

    @fail_returns_none
    def get_location_name(self):
        return urlparse.urlparse(self.url).path.split('/')[2].replace('-', ' ')

    @fail_returns_none
    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[@itemprop="articleBody"]//p')[0])

    @fail_returns_none
    def get_content_date_datetime(self):
        date_text_line = html_parsing.tostring(
            self.root.xpath('.//div[@class="published-info"]//p[@itemprop="datePublished"]')[0])
        date_text = date_text_line.replace('Published on', '').strip()
        return date_parser.parse(date_text).replace(tzinfo=tz.tzutc())

    @fail_returns_none
    def get_entity_overrides(self):
        overrides = {}
        desc_elems = self.root.xpath('.//div[contains(@class, "slide")]//div[@class="caption"]')
        for desc_elem in desc_elems:
            # This strips out elements like <em> and <a> which have non-description text
            # we don't want.
            text_only = ''.join(desc_elem.xpath('./text()')).strip().replace('()', '').strip()
            source_url = desc_elem.xpath('.//a[1]/@href')[0]
            if source_url:
                overrides[source_url] = data.Entity(description=text_only)
        return overrides
