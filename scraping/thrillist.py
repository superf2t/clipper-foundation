import urlparse

import data
from scraping import html_parsing
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class Thrillist(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.thrillist\.com/venues/.+$',
        ('^http(s)?://www\.thrillist\.com/(eat|drink|entertainment)/.+$',
            scraped_page.result_page_expander('.//div[contains(@class, "slide")]//div[@class="caption"]//a[1]'),
            REQUIRES_SERVER_PAGE_SOURCE),)

    NAME_XPATH = './/h1[@itemprop="name"]'
    PHONE_NUMBER_XPATH = './/ul[@class="venue-details"]//a[@itemprop="telephone"]/text()'
    WEBSITE_XPATH = './/ul[@class="venue-details"]//a[@itemprop="url"]/@href'

    @fail_returns_none
    def get_address(self):
        return html_parsing.join_element_text_using_xpaths(self.root,
            ['.//ul[@class="venue-details"]//li[@itemprop="address"]//a//span'])

    def get_location_precision(self):
        return 'Precise'

    @fail_returns_none
    def parse_latlng(self):
        map_url = self.root.xpath('.//ul[@class="venue-details"]//li[@itemprop="address"]//a/@href')[0]
        q = urlparse.parse_qs(urlparse.urlparse(map_url).query)['q'][0]
        lat, lng = q.split(',')
        return {
            'lat': float(lat),
            'lng': float(lng),
        }

    @fail_returns_none
    def get_description(self):
        return tostring(self.root.xpath('.//div[@class="node-body"]//p')[0])

    @fail_returns_none
    def get_category(self):
        return values.Category.FOOD_AND_DRINK

    @fail_returns_none
    def get_primary_photo(self):
        return self.get_photos()[0]

    @fail_returns_empty
    def get_photos(self):
        styles = self.root.xpath('.//section[@class="venue-slideshow"]//span[@class="desktop"]//span[@class="img"]/@style')
        img_urls = []
        for style in styles:
            # Looks like background-image:url(//assets3.thrillist.com/v1/image/1145104/size/tl-horizontal_main)
            img_url = style.split(':')[1].strip()[4:-1]
            img_urls.append(self.absolute_url(img_url))
        return img_urls
