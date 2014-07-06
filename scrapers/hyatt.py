import urlparse

from scrapers.html_parsing import tostring
from scrapers import scraped_page
from scrapers.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
import values

class HyattScraper(scraped_page.ScrapedPage):
    NAME_XPATH = 'body//h1[@class="homePropertyName"]'

    def get_address(self):
        elems = self.root.findall('body//div[@class="addresspanel"]//p[@class="address"]')
        return '%s %s' % (tostring(elems[0], True), tostring(elems[1], True)) 

    def get_primary_photo(self):
        return self.absolute_url(self.root.find('body//div[@id="mastHeadCarousel"]//li//img').get('data-original'))

    def get_photos(self):
        return [self.absolute_url(e.get('data-original')) for e in self.root.findall('body//div[@id="mastHeadCarousel"]//li//img')]

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    @staticmethod
    def expand_reservation_page(url, page_source_tree):
        new_url = page_source_tree.getroot().find('body//li[@class="img_info"]//p[@class="bw"]//a').get('href')
        return (new_url,)

    @staticmethod
    def expand_deep_info_page(url, ignored):
        host = urlparse.urlparse(url).netloc.lower()
        new_url = 'http://%s/en/hotel/home.html' % host
        return (new_url,)

HyattScraper.HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
    '^http(s)?://[^/]+\.hyatt.com/[a-z]+/hotel/home.html.*$',
    ('^http(s)?://[^/]+\.hyatt.com/hyatt/reservations.*$', HyattScraper.expand_reservation_page, False, REQUIRES_CLIENT_PAGE_SOURCE),
    ('^http(s)?://[^/]+\.hyatt.com/[a-z]+/hotel/(?!home).*$', HyattScraper.expand_deep_info_page))
