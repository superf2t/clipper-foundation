import re

import article_parser
import data
from scraping import html_parsing

class Nytimes36HoursCurrent(article_parser.ArticleParser):
    URL_REGEX = re.compile('http://www.nytimes.com/(2013|2014)/\d+/\d+/travel/36-hours-in-.+')    

    TITLE_XPATH = './/h1[@itemprop="headline"]'
    COVER_IMAGE_URL_XPATH = './/div[@class="lede-container"]//div[@class="image"]/img/@src'

    def get_source_url(self):
        idx = self.url.find('?')
        if idx:
            return self.url[:idx]        
        return self.url

    def get_location_name(self):
        return self.get_title()

    def get_description(self):
        return self.root.xpath('.//p[@id="story-continues-1"]/text()')[0]

    def get_raw_entities(self):
        return []
