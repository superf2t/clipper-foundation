import re

import article_parser
import data
from scraping import html_parsing

class Nytimes36HoursCurrent(article_parser.ArticleParser):
    URL_REGEX = re.compile('http://www.nytimes.com/2014/\d+/\d+/travel/36-hours-.+')    

    TITLE_XPATH = './/h1[@itemprop="headline"]'
    COVER_IMAGE_URL_XPATH = './/div[@class="lede-container"]//div[@class="image"]/img/@src'

    def get_location_name(self):
        if '36 Hours in' in self.get_title():
            return self.get_title().replace('36 Hours in ', '')
        return None

    def get_description(self):
        return self.root.xpath('.//p[@id="story-continues-1"]/text()')[0]

    def get_raw_entities(self):
        return []

    @classmethod
    def canonicalize(cls, url):
        idx = url.find('?')
        if idx > -1:
            return url[:idx]        
        return url
