import re

import article_parser
import data
from scraping import html_parsing

class NomadicMatt(article_parser.ArticleParser):
    URL_REGEX = re.compile('^http://www\.nomadicmatt\.com/travel-guides/.+$')    

    TITLE_XPATH = './/div[@id="guides"]/h3[@class="page_title"]'
    COVER_IMAGE_URL_XPATH = ".//div[@id='guides']/p[1]/img/@src"

    def get_location_name(self):
        return self.get_title()

    def get_description(self):
        guide_text = html_parsing.tostring(self.root.find(".//div[@id='guides']")).strip()
        summary_text = guide_text[:guide_text.find('Top Things to Do')].strip()
        if summary_text.startswith(self.get_title()):
            summary_text = summary_text[len(self.get_title()):].strip()
        return summary_text

    def get_raw_entities(self):
        items = self.root.xpath(
            ".//div[@id='guides']//h3[text() = 'Top Things to Do' or text() = 'Top Things to See and Do']/following-sibling::ul//li")
        entities = []
        for item in items:
            raw_text  = html_parsing.tostring(item).strip()
            name, desc = re.split(u'\s?(?:\u2013|-)\s?', raw_text, 1, re.UNICODE)[:2]
            entities.append(data.Entity(name=name, description=desc))
        return entities
