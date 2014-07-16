import re

import geocode
import google_places
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import LocationResolutionStrategy
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

# Only supports review pages
class FodorsScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.fodors\.com/.*/review-\d+\.html.*$',)

    NAME_XPATH = './/h1'
    PHONE_NUMBER_XPATH = './/div[@id="property-review"]//li[@class="phone"]//span[@itemprop="telephone"]/text()'
    WEBSITE_XPATH = './/div[@id="property-review"]//li[@class="website"]//a/@href'

    RATING_MAX = 5

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ENTITY_NAME_WITH_GEOCODER,
        LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH,
        LocationResolutionStrategy.ADDRESS)

    # TODO: Generalize fallbacks so that if an address comes from Google, 
    # all location properties also come from Google
    @fail_returns_empty
    def get_address(self):
        street_node = self.root.find('.//li[@class="address"]//span[@itemprop="streetAddress"]')
        locality_node = self.root.find('.//li[@class="address"]//span[@itemprop="addressLocality"]')
        postal_node = self.root.find('.//li[@class="address"]//span[@itemprop="postalCode"]')
        
        if street_node is not None and locality_node is not None:
            street = tostring(street_node, True).replace(',', '')
            locality = tostring(locality_node, True).replace(',', '')
            if postal_node is not None:
                postal_code = tostring(postal_node, True).replace(',', '')
                return '%s %s %s' % (street, locality, postal_code)
            else:
                return '%s %s' % (street, locality)
        else:
            return self.lookup_google_place().address

    def get_city(self):
        city = self.url.split('/')[-2].replace('-', ' ')
        return city.title()

    def lookup_google_place(self):
        if not hasattr(self, '_google_place'):
            city = self.get_city()
            query = '%s %s' % (self.get_entity_name(), city)
            place_result = geocode.lookup_place(query)
            if place_result:
                place = google_places.lookup_place_by_reference(place_result.get_reference())
                self._google_place = place.to_entity() if place else None
            else:
                self._google_place = None
        return self._google_place

    @fail_returns_none
    def get_category(self):
        breadcrumb_url = self.root.findall('.//ul[@class="breadcrumb"]//li//a')[-1].get('href').lower()
        if 'hotels' in breadcrumb_url:
            return values.Category.LODGING
        elif 'restaurants' in breadcrumb_url:
            return values.Category.FOOD_AND_DRINK
        else:
            return values.Category.ATTRACTIONS

    @fail_returns_none
    def get_sub_category(self):
        category = self.get_category();
        if category == values.Category.LODGING:
            return values.SubCategory.HOTEL
        elif category == values.Category.FOOD_AND_DRINK:
            return values.SubCategory.RESTAURANT
        else:
            return None

    # Convert Fodor's star rating (represented as % of 100% but render as out of 5 stars)
    # to normalized scale
    def get_rating(self):
        rating_value_node = self.root.find('.//div[@class="property-name"]//span[@class="ratings-value star5"]')
        if rating_value_node is not None:
            rating_value_string = rating_value_node.get('style')
            rating_value = re.sub('[^0-9]', '', rating_value_string)
            converted_rating_value = float(rating_value) / 100 * 5
            return converted_rating_value
        else:
            return None

    def get_primary_photo(self):
        photo_urls = self.get_photos()
        return photo_urls[0] if photo_urls else None

    def get_photos(self):
        google_place_entity = self.lookup_google_place()
        return google_place_entity.photo_urls[:] if google_place_entity else []
