from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
import values

class FoursquareScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://foursquare\.com/v/.+$',
        ('^http(s)?://foursquare\.com/explore\?.+$', 
            scraped_page.result_page_expander('.//div[@id="results"]//div[@class="venueBlock"]//div[@class="venueName"]//a'),
            False, REQUIRES_CLIENT_PAGE_SOURCE),
        ('^http(s)?://foursquare\.com/[^/]+/list/.+$',
            scraped_page.result_page_expander('.//div[@id="allItems"]//div[contains(@class, "s-list-item")]//a'),
            REQUIRES_SERVER_PAGE_SOURCE))

    NAME_XPATH = './/h1[@class="venueName"]'

    def get_address(self):
        parts = self.root.xpath('.//div[@class="adr"]//span[@itemprop]/text()')
        return ', '.join(parts)

    def parse_latlng(self):
        lat_str = self.root.find('.//meta[@property="playfoursquare:location:latitude"]').get('content')
        lng_str = self.root.find('.//meta[@property="playfoursquare:location:longitude"]').get('content')
        return {
            'lat': float(lat_str),
            'lng': float(lng_str),
        }

    def get_location_precision(self):
        if self.parse_latlng():
            return 'Precise'
        return super(FoursquareScraper, self).get_location_precision()

    def get_photos(self):
        urls = [img.get('src') for img in self.root.findall('.//ul[@class="photos"]//li//img')]
        return [url.replace('152x152', 'width960').replace('50x50', 'width960') for url in urls if 'icon-camera' not in url]

    def get_primary_photo(self):
        photos = self.get_photos()
        return photos[0] if photos else None

    def get_category(self):
        category_node = self.root.find('.//div[@class="primaryInfo"]//div[@class="categories"]')
        category_str = tostring(category_node).lower()
        if contains_any(category_str, ('restaurant', 'bar', 'ice cream', 'dessert', 'bakery', 'coffee')):
            return values.Category.FOOD_AND_DRINK
        if contains_any(category_str, ('hotel', 'motel', 'hostel')):
            return values.Category.LODGING
        if contains_any(category_str, ('monument', 'landmark')):
            return values.Category.ATTRACTIONS
        if contains_any(category_str, ('store', 'shop', 'boutique')):
            return values.Category.SHOPPING
        if contains_any(category_str, ('concert hall', 'jazz club', 'rock club', 'stadium')):
            return values.Category.ENTERTAINMENT
        return None

    def get_sub_category(self):
        category_node = self.root.find('.//div[@class="primaryInfo"]//div[@class="categories"]')
        category_str = tostring(category_node).lower()
        parsed_category = self.get_category()
        if parsed_category == values.Category.FOOD_AND_DRINK:
            if 'restaurant' in category_str:
                return values.SubCategory.RESTAURANT
            if 'coffee' in category_str:
                return values.SubCategory.COFFEE_SHOP
            if 'bar' in category_str:
                return values.SubCategory.BAR
            if contains_any(category_str, ('ice cream', 'dessert')):
                return values.SubCategory.DESSERT
            if 'bakery' in category_str:
                return values.SubCategory.BAKERY
        if parsed_category == values.Category.LODGING:
            if contains_any(category_str, ('hotel', 'motel')):
                return values.SubCategory.HOTEL
            if 'hostel' in category_str:
                return values.SubCategory.HOSTEL
        if parsed_category == values.Category.ENTERTAINMENT:
            if contains_any(category_str, ('concert hall', 'jazz club', 'rock club')):
                return values.SubCategory.MUSIC
            if 'stadium' in category_str:
                return values.SubCategory.SPORTS
        return None

def contains_any(s, values):
    for value in values:
        if value in s:
            return True
    return False
