import json

import crossreference
from scraping import hotels_dot_com
from scraping import html_parsing
from scraping import scraped_page
from scraping.scraped_page import LocationResolutionStrategy
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class TripAdvisorScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.tripadvisor\.com/[A-Za-z]+_Review.*\.html.*$',
        ('^http(s)?://www\.tripadvisor\.com/Guide-.*\.html$', 
            scraped_page.result_page_expander('.//div[@id="GUIDE_DETAIL"]//div[@class="guideItemInfo"]//a[@class="titleLink"]'),
            REQUIRES_SERVER_PAGE_SOURCE),
        ('^http(s)?://www\.tripadvisor\.com/Attractions-.*\.html$',
            scraped_page.result_page_expander('.//div[@id="ATTRACTION_OVERVIEW"]//div[contains(@class, "listing") and not(contains(@class, "noContent"))]//a[@class="property_title"]'),
            REQUIRES_SERVER_PAGE_SOURCE),
        ('^http(s)?://www\.tripadvisor\.com/Hotels-.*\.html$',
            scraped_page.result_page_expander('.//div[@id="HAC_RESULTS"]//div[contains(@class, "listing") and not(contains(@class, "noContent"))]//a[@class="property_title"]'),
            REQUIRES_SERVER_PAGE_SOURCE),
        ('^http(s)?://www\.tripadvisor\.com/Restaurants-.*\.html$',
            scraped_page.result_page_expander('.//div[@id="EATERY_SEARCH_RESULTS"]//div[contains(@class, "listing") and not(contains(@class, "noContent"))]//a[@class="property_title"]'),
            REQUIRES_SERVER_PAGE_SOURCE))


    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address/span[@rel="v:address"]//span[@class="format_address"]'
    PHONE_NUMBER_XPATH = './/div[@id="HEADING_GROUP"]//div[contains(@class, "phoneNumber")]/text()'

    RATING_MAX = 5

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ENTITY_NAME_WITH_GEOCODER,
        LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH,
        LocationResolutionStrategy.ADDRESS)

    def get_category(self):
        if '/Hotel_Review' in self.url:
            return values.Category.LODGING
        elif '/Restaurant_Review' in self.url:
            return values.Category.FOOD_AND_DRINK
        elif '/Attraction_Review' in self.url:
            return values.Category.ATTRACTIONS
        return None

    # TODO: Make this more specific
    @fail_returns_none
    def get_sub_category(self):
        if '/Hotel_Review' in self.url:
            return values.SubCategory.HOTEL
        elif '/Restaurant_Review' in self.url:
            return values.Category.RESTAURANT
        elif '/Attraction_Review' in self.url:
            return None
        return None

    @fail_returns_none
    def get_description(self):
        desc_nodes = self.root.xpath('.//div[@id="listing_main"]//div[@class="listing_description"]')
        if not desc_nodes:
            return None
        desc_node = desc_nodes[0]
        details_link = desc_node.xpath('.//a/@href')
        if details_link:
            url = self.absolute_url(details_link[0])
            details_page_tree = html_parsing.parse_tree(url)
            details_node = details_page_tree.getroot().xpath('.//div[@class="articleBody"]')[0]
            return html_parsing.join_element_text_using_xpaths(details_node, ['.//p'], '\n\n')
        else:
            return ''.join(desc_node.xpath('text()')).strip()

    @fail_returns_none
    def get_rating(self):
        return float(self.root.find('body//div[@rel="v:rating"]//img').get('content'))

    @fail_returns_none
    def get_review_count(self):
        return int(self.root.xpath('.//div[@id="listing_main"]//div[contains(@class, "rating")]//span[@property="v:count"]/text()')[0].replace(',', ''))

    @fail_returns_none
    def get_primary_photo(self):
        try:
            img_url = self.root.find('body//img[@class="photo_image"]').get('src')
        except:
            img_url = None
        if img_url:
            return img_url
        for script in self.root.findall('body//script'):
            if 'lazyImgs' in script.text:
                lines = script.text.split('\n')
                for line in lines:
                    if 'HERO_PHOTO' in line:
                        some_json = json.loads(line)
                        return some_json['data']
        return None

    @fail_returns_empty
    def get_photos(self):
        urls = []
        try:
            url = self.root.find('body//img[@class="photo_image"]').get('src')
            if url:
                urls.append(url)
        except:
            pass
        for script in self.root.findall('body//script'):
            if script.text and 'lazyImgs' in script.text:
                lines = script.text.split('\n')
                for line in lines:
                    for elem_id in ('HERO_PHOTO', 'THUMB_PHOTO'):
                        if elem_id in line:
                            line = line.strip().strip(',')
                            some_json = json.loads(line)
                            urls.append(some_json['data'])
                break
        if self.get_category() == values.Category.LODGING:
            hotelsdotcom_url = crossreference.find_hotelsdotcom_url(self.get_entity_name())
            if hotelsdotcom_url:
                tree = html_parsing.parse_tree(hotelsdotcom_url)
                hotelsdotcom_scraper = hotels_dot_com.HotelsDotComScraper(url, tree)
                additional_urls = hotelsdotcom_scraper.get_photos()
                urls.extend(additional_urls)
        return urls
