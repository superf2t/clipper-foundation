import json
import urlparse

import data
from scraping import html_parsing
from scraping.html_parsing import tostring
from scraping.html_parsing import tostring_with_breaks
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class YelpScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/biz/.*$',
        ('^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/search\?.*$',
            scraped_page.result_page_expander('.//div[@class="results-wrapper"]'
                + '//div[contains(@class, "search-result") and not(contains(@class, "yla"))]'
                + '//h3[@class="search-result-title"]//a[@class="biz-name"]'),
            False, REQUIRES_CLIENT_PAGE_SOURCE),
        ('^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/user_details.*$',
            scraped_page.result_page_expander('.//div[@id="user-details"]//div[@class="biz_info"]//h4//a'),
            False, REQUIRES_CLIENT_PAGE_SOURCE))

    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address[@itemprop="address"]'
    PHONE_NUMBER_XPATH = './/span[@itemprop="telephone"]/text()'
    REVIEW_COUNT_XPATH = './/span[@itemprop="reviewCount"]/text()'
    PRIMARY_PHOTO_XPATH = 'body//div[@class="showcase-photos"]//div[@class="showcase-photo-box"]//img'

    RATING_MAX = 5

    @fail_returns_none
    def get_category(self):
        categories_parent = self.root.find('body//span[@class="category-str-list"]')
        categories_str = tostring(categories_parent)
        categories = [c.strip().lower() for c in categories_str.split(',')]
        if 'hotel' in categories or 'hotels' in categories or 'bed & breakfast' in categories:
            return values.Category.LODGING
        else:
            return values.Category.FOOD_AND_DRINK

    @fail_returns_none
    def get_sub_category(self):
        categories_parent = self.root.find('body//span[@class="category-str-list"]')
        categories_str = tostring(categories_parent)
        categories = [c.strip().lower() for c in categories_str.split(',')]
        if 'bed & breakfast' in categories:
            return values.SubCategory.BED_AND_BREAKFAST
        elif 'hotel' in categories or 'hotels' in categories:
            return values.SubCategory.HOTEL
        else:
            for category in categories:
                if 'bar' in category:
                    return values.SubCategory.BAR
            return values.SubCategory.RESTAURANT

    @fail_returns_none
    def get_rating(self):
        return float(self.root.find('body//meta[@itemprop="ratingValue"]').get('content'))

    @fail_returns_none
    def get_primary_photo(self):
        return super(YelpScraper, self).get_primary_photo().replace('ls.jpg', 'l.jpg')

    @fail_returns_empty
    def get_photos(self):
        urls = []
        photo_page_url = 'http://www.yelp.com/biz_photos/' + self.get_site_specific_entity_id()
        photos_root = html_parsing.parse_tree(photo_page_url).getroot()
        for thumb_img in photos_root.findall('body//div[@id="photo-thumbnails"]//a/img'):
            urls.append(thumb_img.get('src').replace('ms.jpg', 'l.jpg'))
        return urls

    @fail_returns_none
    def get_website(self):
        redirect_url = self.root.xpath('.//div[@class="biz-website"]//a/@href')[0]
        params = urlparse.parse_qs(urlparse.urlparse(redirect_url).query)
        return params['url'][0]

    @fail_returns_none
    def get_opening_hours(self):
        hours_nodes = self.root.xpath('.//table[contains(@class, "hours-table")]//tr')
        texts = []
        for node in hours_nodes:
            day = tostring(node.find('th'))
            times = tostring_with_breaks(node.find('td'))
            texts.append('%s\t%s' % (day, times))
        source_text = '\n'.join(texts)
        return data.OpeningHours(source_text=source_text)

    @fail_returns_none
    def parse_latlng(self):
        map_data_elem = self.root.xpath('.//div[@class="mapbox"]//div[contains(@class, "lightbox-map")]')[0]
        map_data = json.loads(map_data_elem.get('data-map-state'))
        location = map_data['markers']['starred_business']['location']
        return {
            'lat': location['latitude'],
            'lng': location['longitude'],
        }

    @fail_returns_none
    def get_site_specific_entity_id(self):
        path = urlparse.urlparse(self.url).path
        return path.split('/')[2]
