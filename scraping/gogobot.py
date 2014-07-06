import urlparse

from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class GogobotScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.gogobot\.com/[^/]+-(attraction|restaurant|hotel|vacation-rental)(/.+)?$',
        ('^http(s)?://www\.gogobot\.com/[^/]+--(things_to_do|restaurants|hotels|vacation_rentals)(/.*)?$', 
            scraped_page.result_page_expander('.//div[@class="items_list"]//h2//a'),
            REQUIRES_SERVER_PAGE_SOURCE, False))

    NAME_XPATH = './/h1'
    ADDRESS_XPATH = './/div[@class="addressDetails"]'
    PRIMARY_PHOTO_XPATH = './/img[@id="initial_image"]'

    @fail_returns_none
    def parse_latlng(self):
        latlng_str = self.root.xpath('.//div[@class="placeNameDiv"]//div[@class="row"]/@title')[0]
        lat_str, lng_str = latlng_str.split(';')
        return { 'lat': float(lat_str), 'lng': float(lng_str) }

    @fail_returns_none
    def get_category(self):
        path_root = self.get_path_root()
        if path_root.endswith('restaurant'):
            return values.Category.FOOD_AND_DRINK
        elif path_root.endswith('hotel') or path_root.endswith('vacation-rental'):
            return values.Category.LODGING
        return values.Category.ATTRACTIONS

    @fail_returns_none
    def get_sub_category(self):
        category_node = self.root.xpath('.//li[contains(@class, "categoriesList")]//div[contains(@class, "categories")]')
        if category_node:
            categories = tostring(category_node[0]).split(',')
            categories = [s.strip().lower() for s in categories]
        else:
            categories = []

        path_root = self.get_path_root()
        tc_category = self.get_category()
        if tc_category == values.Category.FOOD_AND_DRINK:
            # Gogobot doesn't seem to have categories like restaurant/bar/bakery
            # They do have cuisine types like French though.
            return values.SubCategory.RESTAURANT
        elif tc_category == values.Category.ATTRACTIONS:
            if contains_any(categories, ['monument', 'historic site']):
                return values.SubCategory.LANDMARK
            elif contains_any(categories, ['sights and museums', 'art museum']):
                return values.SubCategory.MUSEUM
        elif tc_category == values.SubCategory.LODGING:
            if path_root.endswith('hotel'):
                return values.SubCategory.HOTEL
            elif path_root.endswith('vacation-rental'):
                return values.SubCategory.VACATION_RENTAL
        return None

    @fail_returns_none
    def get_rating(self):
        rating_node = self.root.xpath('.//div[@id="topicAboutDiv"]//span[@class="rating"]//span[@class="average"]')[0]
        return float(tostring(rating_node, with_tail=False))

    @fail_returns_empty
    def get_photos(self):
        urls = self.root.xpath('.//noscript//img/@src')
        return [url for url in urls if 'gbot.me/photos' in url]

    def get_path_root(self):
        return urlparse.urlparse(self.url).path.split('/')[1]

def contains_any(s, values):
    for value in values:
        if value in s:
            return True
    return False
