import re
import urlparse

from scraping.html_parsing import tostring
from scraping.html_parsing import tostring_with_breaks
from scraping import scraped_page
from scraping.scraped_page import LocationResolutionStrategy
from scraping.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class HotelsDotComScraper(scraped_page.ScrapedPage):
    NAME_XPATH = 'body//h1'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="hotel-photos"]//div[@class="slide active"]//img'

    RATING_MAX = 5

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ADDRESS, LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH)

    @fail_returns_none
    def get_address(self):
        addr_parent = self.root.find('body//div[@class="address-cntr"]/span[@class="adr"]')
        street_addr = tostring_with_breaks(addr_parent.find('span[@class="street-address"]')).strip()
        street_addr = re.sub('\s+', ' ', street_addr)
        postal_addr = tostring_with_breaks(addr_parent.find('span[@class="postal-addr"]')).strip()
        postal_addr = re.sub('\s+', ' ', postal_addr)
        country = tostring_with_breaks(addr_parent.find('span[@class="country-name"]')).strip().strip(',')
        return '%s %s %s' % (street_addr, postal_addr, country)

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    @fail_returns_none
    def get_rating(self):
        # Looks like "4.5 / 5"
        rating_fraction_str = tostring(self.root.find('body//div[@class="score-summary"]/span[@class="rating"]'))
        return float(rating_fraction_str.split('/')[0].strip())

    @fail_returns_empty
    def get_photos(self):
        carousel_thumbnails = self.root.findall('body//div[@id="hotel-photos"]//ol[@class="thumbnails"]//li//a')
        return [thumb.get('href') for thumb in carousel_thumbnails]

    @fail_returns_none
    def parse_latlng(self):
        geo_meta = self.root.find('.//meta[@name="geo.position"]')
        if geo_meta is not None:
            lat, lng = map(float, geo_meta.get('content').split(','))
            return {
                'lat': lat,
                'lng': lng
                }

    @fail_returns_none
    def get_review_count(self):
        text = tostring(self.root.xpath('.//div[@class="total-reviews"]')[0])
        # Looks like 'See all 300 hotels.com reviews'
        return int(text.split()[2])

    @fail_returns_none
    def get_phone_number(self):
        text = self.root.xpath('.//div[@class="address-cntr"]//span[@class="phone-number"]/text()')[0]
        return text.strip().strip(u'\u200E\u200F')

    @staticmethod
    def expand_using_hotel_id(url, ignored):
        hotel_id = urlparse.parse_qs(urlparse.urlparse(url.lower()).query)['hotelid'][0]
        new_url = 'http://www.hotels.com/hotel/details.html?hotelId=%s' % hotel_id
        return (new_url,)

HotelsDotComScraper.HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
    '^http(s)?://([a-z]{2,3})\.hotels\.com/hotel/details\.html.*$',
    ('(?i)^http(s)?://([a-z]{2,3})\.hotels\.com/ho\d+/.*hotelid=\d+.*$', HotelsDotComScraper.expand_using_hotel_id),
    ('^http(s)?://([a-z]{2,3})\.hotels\.com/search\.do\?.*$', 
        scraped_page.result_page_expander('.//li[@class=" hotel"]//h3[@class="hotel-name"]//a'),
        False, REQUIRES_CLIENT_PAGE_SOURCE))
