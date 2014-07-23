from scraping import html_parsing
from scraping import scraped_page
from scraping.scraped_page import LocationResolutionStrategy
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_none
import values

import urlparse

class TravelAndLeisure(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.travelandleisure\.com/travel-guide/.+/(activities|restaurants|hotels)/.+$',
        ('^http(s)?://www\.travelandleisure\.com/trips/.+$',
            scraped_page.result_page_expander('.//div[@id="accordion"]/div[not(@id="similar-trips-area")]//ul[@class="list"]//h4//a'),
            REQUIRES_SERVER_PAGE_SOURCE))

    NAME_XPATH = './/h1'
    WEBSITE_XPATH = './/div[@class="website"]//a/@href'

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH,
        LocationResolutionStrategy.ADDRESS)

    @fail_returns_none
    def get_phone_number(self):
        return ''.join(self.root.xpath('.//div[@class="telephone"]/text()')).strip()

    @fail_returns_none
    def get_address(self):
        return html_parsing.tostring_with_breaks(
            self.root.xpath('.//div[@class="address"]')[0])

    @fail_returns_none
    def get_category(self):
        category = urlparse.urlparse(self.url).path.split('/')[3]
        return {
            'restaurants': values.Category.FOOD_AND_DRINK,
            'hotels': values.Category.LODGING,
            'activities': values.Category.ATTRACTIONS
        }.get(category)

    @fail_returns_none
    def get_sub_category(self):
        category = urlparse.urlparse(self.url).path.split('/')[3]
        return {
            'restaurants': values.SubCategory.RESTAURANT,
            'hotels': values.SubCategory.HOTEL,
        }.get(category)

    @fail_returns_none
    def get_description(self):
        return html_parsing.join_element_text_using_xpaths(
            self.root.xpath('.//div[@class="description"]')[0],
            ['./*[not(@class="related-content")]'], '\n\n')
