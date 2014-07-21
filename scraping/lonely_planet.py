import data
import geocode
import google_places
from scraping.html_parsing import join_element_text_using_xpaths
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class LonelyPlanetScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/hotels/(?!guesthouse|apartments|rated|hostels-and-budget-hotels).*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/shopping/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/entertainment-nightlife/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/sights/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/restaurants/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/.+/activities/.*$',
        ('(?i)^http(s)?://www\.lonelyplanet\.com/.+/things-to-do.*$', 
            scraped_page.result_page_expander('.//article/a'), REQUIRES_SERVER_PAGE_SOURCE),)

    NAME_XPATH = './/h1'
    PHONE_NUMBER_XPATH = './/dl[@class="info-list"]//a[@class="tel"]/text()'
    WEBSITE_XPATH = './/dl[@class="info-list"]//dt[contains(@class, "icon--mouse")]/following-sibling::dd//a/@href'

    def get_address(self):
        city, country = self.get_city_and_country()
        if '/hotels/' in self.url:
            street_and_city_node = self.root.xpath('.//span[contains(@class, "lodging__subtitle--address")]')[0]
            street_and_city = tostring(street_and_city_node, True)
            return '%s %s' % (street_and_city, country)
        else:
            street_node = self.root.find('.//dl[@class="info-list"]//dd[@class="copy--meta"]//strong')
            if street_node is not None:
                street = tostring(street_node, True)
                return '%s %s %s' % (street, city, country)
            else:
                return self.lookup_google_place().address

    def get_category(self):
        url = self.url.lower()
        if '/hotels/' in url:
            return values.Category.LODGING
        elif '/restaurants/' in url:
            return values.Category.FOOD_AND_DRINK
        elif '/sights/' in url or '/shopping/' in url or '/entertainment-nightlife/' in url:
            return values.Category.ATTRACTIONS
        return values.Category.ATTRACTIONS

    def get_sub_category(self):
        url = self.url.lower()
        if '/hotels/' in url:
            hotel_type_node = self.root.xpath('.//span[contains(@class, "lodging__subtitle")]')[0]
            hotel_type = tostring(hotel_type_node, True)
            if hotel_type == 'Guesthouse':
                return values.SubCategory.BED_AND_BREAKFAST
            elif hotel_type == 'Hostel':
                return values.SubCategory.HOSTEL
            else:
                return values.SubCategory.HOTEL
        elif '/restaurants/' in url:
            return values.SubCategory.RESTAURANT
        return None

    def get_primary_photo(self):
        try:
            return self.root.find('.//img[@class="media-gallery__img"]').get('src')
        except:
            photo_urls = self.get_photos()
            return photo_urls[0] if photo_urls else None

    def get_city_and_country(self):
        country, city = self.url.split('/')[3:5]
        return city.title(), country.title()

    def lookup_google_place(self):
        if not hasattr(self, '_google_place'):
            city, country = self.get_city_and_country()
            query = '%s %s %s' % (self.get_entity_name(), city, country)
            place_result = geocode.lookup_place(query)
            if place_result:
                place = google_places.lookup_place_by_reference(place_result.get_reference())
                self._google_place = place.to_entity() if place else None
            else:
                self._google_place = None

        return self._google_place

    @fail_returns_empty
    def get_photos(self):
        return self.root.xpath('.//img[contains(@class, "slider__img")]/@src') + \
            self.root.xpath('.//img[contains(@data-class, "slider__img")]//@data-src')

    def get_latlng(self):
        google_place_entity = self.lookup_google_place()
        if google_place_entity:
            return google_place_entity.latlng.to_json_obj() if google_place_entity.latlng else None
        return None

    def get_location_precision(self):
        return 'Precise' if self.get_latlng() else 'Imprecise'

    @fail_returns_none
    def get_opening_hours(self):
        source_text = tostring(self.root.xpath('.//dl[@class="info-list"]//dt[contains(@class, "icon--time")]/following-sibling::dd')[0])
        return data.OpeningHours(source_text=source_text)

    def get_starred(self):
        if not self.for_guide:
            return False
        top_choice_elem = self.root.xpath('.//div[@role="main" and contains(@class, "card--top-choice")]')
        return bool(top_choice_elem)

    @fail_returns_none
    def get_description(self):
        return join_element_text_using_xpaths(self.root,
            ['.//div[contains(@class, "ttd__section--description")]//p'], '\n\n').strip()

