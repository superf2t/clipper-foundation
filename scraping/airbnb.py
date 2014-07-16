from scraping import scraped_page
from scraping.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class AirbnbScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)://www\.airbnb\.(com|[a-z]{2})(\.[a-z]{2})?/rooms/\d+.*$',
        ('^http(s)://www\.airbnb\.(com|[a-z]{2})(\.[a-z]{2})?/s/.*$',
            scraped_page.result_page_expander('.//div[contains(@class, "search-results")]//div[contains(@class, "listing")]//div[contains(@class, "listing-info")]//a'),
            False, REQUIRES_CLIENT_PAGE_SOURCE))

    NAME_XPATH = 'body//div[@id="listing_name"]'
    ADDRESS_XPATH = 'body//div[@id="room"]//span[@id="display-address"]'
    REVIEW_COUNT_XPATH = './/div[@id="room"]//li[@class="review_count"]//i/text()'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="photos"]//ul[@class="slideshow-images"]//li[@class="active"]//img'

    RATING_MAX = 5

    @fail_returns_none
    def get_entity_name(self):
        return 'Airbnb: ' + super(AirbnbScraper, self).get_entity_name()

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.PRIVATE_RENTAL

    @fail_returns_none
    def get_rating(self):
        return float(self.root.find('body//div[@id="room"]//meta[@itemprop="ratingValue"]').get('content'))

    @fail_returns_empty
    def get_photos(self):
        thumbs = self.root.findall('body//div[@id="photos"]//div[@class="thumbnails-viewport"]//li//a')
        return [thumb.get('href') for thumb in thumbs]
