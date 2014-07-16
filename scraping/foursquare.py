import data
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_none
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
    PHONE_NUMBER_XPATH = './/div[@class="venueDetail"]//span[@itemprop="telephone"]/text()'
    WEBSITE_XPATH = './/div[@class="venueDetail"]//div[contains(@class, "venueWebsite")]//a[@itemprop="url"]/@href'

    RATING_MAX = 10

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

    @fail_returns_none
    def get_rating(self):
        return float(self.root.xpath('.//div[@class="venueDetail"]//span[@itemprop="ratingValue"]/text()')[0])

    @fail_returns_none
    def get_review_count(self):
        # This is technically the number of 'tips'
        text = self.root.xpath('.//div[@class="venueDetail"]//h3[@class="tipCount"]//text()')[0]
        return int(text.split()[0])

    @fail_returns_none
    def get_opening_hours(self):
        timeframes = self.root.xpath('.//div[@class="venueDetail"]//div[@class="allHours"]//ul[@class="timeframes"]//li[@class="timeframe"]')
        timeframes_text = []
        for t in timeframes:
            text = '%s\t%s' % (tostring(t.xpath('.//span[@class="timeframeDays"]')[0]),
                tostring(t.xpath('.//span[@class="timeframeHours"]')[0]))
            timeframes_text.append(text)
        source_text = '\n'.join(timeframes_text)
        return data.OpeningHours(source_text=source_text)

def contains_any(s, values):
    for value in values:
        if value in s:
            return True
    return False
