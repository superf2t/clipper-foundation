import decimal

from scrapers import scraped_page
from scrapers.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scrapers.scraped_page import fail_returns_none
import values

class BookingDotComScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns('^http(s)?://www\.booking\.com/hotel/.*$',
        ('^http(s)?://www\.booking\.com/(flexiblesr|searchresults).*$',
            scraped_page.result_page_expander('.//div[@class="sr_item_content"]//a[@class="hotel_name_link url "]'),
            REQUIRES_SERVER_PAGE_SOURCE))

    NAME_XPATH = 'body//h1//span[@id="hp_hotel_name"]'
    ADDRESS_XPATH = 'body//p[@class="address"]/span'
    PRIMARY_PHOTO_XPATH = 'body//div[@class="photo_contrain"]//img[@id="photo_container"]'

    def parse_latlng(self):
        coords_span = self.root.find('body//p[@class="address"]/span[@data-coords]')
        if coords_span is None:
            return None
        coords = coords_span.get('data-coords')
        lng, lat = coords.split(',')
        lat = float('%.6f' % decimal.Decimal(lat))
        lng = float('%.6f' % decimal.Decimal(lng))
        return {'lat': lat, 'lng': lng}

    def get_location_precision(self):
        if self.parse_latlng():
            return 'Precise'
        return super(BookingDotComScraper, self).get_location_precision()

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        summary_info = self.root.find('body//div[@id="hotel_main_content"]//p[@class="summary  "]')
        if summary_info is not None:
            summary_text = summary_info.text.strip().lower()
            if 'bed and breakfast' in summary_text:
                return values.SubCategory.BED_AND_BREAKFAST
            elif 'hostel' in summary_text:
                return values.SubCategory.HOSTEL
            elif 'hotel' in summary_text:
                return values.SubCategory.HOTEL
        return values.SubCategory.HOTEL

    @fail_returns_none
    def get_rating(self):
        numerator = float(self.root.find('body//div[@class="hotel_large_photp_score"]//span[@class="average"]').text)
        denominator = int(self.root.find('body//div[@class="hotel_large_photp_score"]//span[@class="best"]').text)
        return numerator / denominator * 5

    def get_photos(self):
        thumbs = self.root.findall('body//div[@id="photos_distinct"]//a[@data-resized]')
        return [thumb.get('data-resized') for thumb in thumbs]
