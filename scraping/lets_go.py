import re
import urlparse

import article_parser
import data
from scraping import html_parsing
import utils

class LetsGo(article_parser.ArticleParser):
    URL_REGEX = re.compile('^(http://www\.letsgo\.com/[a-z]+)$')    

    TITLE_XPATH = './/div[@class="title-desc-inner"]//h1'
    COVER_IMAGE_URL_XPATH = ".//div[contains(@class, 'banner-image')]//img/@data-src"

    def get_location_name(self):
        return self.get_title()

    def get_description(self):
        p_elems = self.root.xpath(".//h1[text() = 'Overview']/following-sibling::p")
        return '\n\n'.join(html_parsing.tostring(p) for p in p_elems)

    def get_raw_entities(self):
        path = urlparse.urlparse(self.url).path
        links = self.root.xpath(".//div[@class='content']//a/@href")
        entity_links = [urlparse.urljoin(self.url, l.strip()) for l in links if l.startswith(path)]
        return utils.parallelize(self.scrape_entity_page, [(l,) for l in entity_links])

    def scrape_entity_page(self, url):
        entity_root = html_parsing.parse_tree(url).getroot()
        name = html_parsing.tostring(entity_root.xpath('.//div[@class="title-desc-inner"]//h1')[0])
        content_p_elems = entity_root.xpath(".//div[@class='content']//div[not(@class='image-caption')]/p")
        description = '\n\n'.join(html_parsing.tostring(p) for p in content_p_elems)
        photo_urls = entity_root.xpath(".//div[@class='content']//img/@data-src")
        return data.Entity(name=name, description=description, photo_urls=photo_urls)
