import json
import re

from dateutil import parser as date_parser
from dateutil import tz

import article_parser
import data
from scraping import html_parsing
from scraping.scraped_page import fail_returns_none

class BonAppetitGuide(article_parser.ArticleParser):
    URL_REGEX = re.compile('(http://www\.bonappetit\.com/restaurants-travel/[^?]+).*')

    TITLE_XPATH = './/h1'
    COVER_IMAGE_URL_XPATH = './/div[@class="start_overlay"]//img/@src'

    @fail_returns_none
    def get_location_name(self):
        return self.get_title().split(' in ')[1].strip()

    @fail_returns_none
    def get_description(self):
        return html_parsing.tostring(
            self.root.xpath('.//div[contains(@class, "intro_text")]//p')[0])

    @fail_returns_none
    def get_content_date_datetime(self):
        date_text_line = html_parsing.tostring(
            self.root.xpath('.//div[@class="top_meta"]//span[@class="date"]')[0])
        date_text = date_text_line.replace('Published on', '').strip()
        return date_parser.parse(date_text).replace(tzinfo=tz.tzutc())

    def get_raw_entities(self):
        slideshow_js = self.root.xpath('.//article[@id="slide-content"]/script/text()')[0].strip()
        slideshow_js = slideshow_js.replace('var Slideshow = ', '').rstrip(';').strip()
        parsed_js = json.loads(slideshow_js)
        entities = []
        for obj in parsed_js['relatedContent']:
            item = obj['item']
            img_url = item['body']['photo']['images']['image'][0]['source']
            desc_html = item['subHeaders']['subHeader']['text'].strip().encode('utf-8')
            desc_html_no_metadata = re.sub('<em>.*</em>$', '', desc_html)
            desc = html_parsing.tostring(html_parsing.parse_tree_from_string('<foo>%s</foo>' % desc_html_no_metadata))
            entities.append(data.Entity(photo_urls=[img_url], description=desc))
        return entities
