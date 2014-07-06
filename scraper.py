import decimal
import re
import urllib2
import urlparse

from lxml import etree

import geocode
import google_places
from scrapers import html_parsing
from scrapers.html_parsing import tostring
from scrapers.html_parsing import tostring_with_breaks
from scrapers import scraped_page
from scrapers.scraped_page import LocationResolutionStrategy
from scrapers.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
from scrapers.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scrapers.scraped_page import fail_returns_empty
from scrapers.scraped_page import fail_returns_none
import utils
import values


class YelpScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/biz/.*$',
        ('^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/search\?.*$',
            scraped_page.result_page_expander('.//div[@class="results-wrapper"]//h3[@class="search-result-title"]//a[@class="biz-name"]'),
            False, REQUIRES_CLIENT_PAGE_SOURCE),
        ('^http(s)?://www\.yelp\.(com|[a-z]{2})(\.[a-z]{2})?/user_details.*$',
            scraped_page.result_page_expander('.//div[@id="user-details"]//div[@class="biz_info"]//h4//a'),
            False, REQUIRES_CLIENT_PAGE_SOURCE))

    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address[@itemprop="address"]'
    PRIMARY_PHOTO_XPATH = 'body//div[@class="showcase-photos"]//div[@class="showcase-photo-box"]//img'

    @fail_returns_none
    def get_category(self):
        categories_parent = self.root.find('body//span[@class="category-str-list"]')
        categories_str = etree.tostring(categories_parent, encoding='unicode', method='text')
        categories = [c.strip().lower() for c in categories_str.split(',')]
        if 'hotel' in categories or 'hotels' in categories or 'bed & breakfast' in categories:
            return values.Category.LODGING
        else:
            return values.Category.FOOD_AND_DRINK

    @fail_returns_none
    def get_sub_category(self):
        categories_parent = self.root.find('body//span[@class="category-str-list"]')
        categories_str = etree.tostring(categories_parent, encoding='unicode', method='text')
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
    def get_site_specific_entity_id(self):
        path = urlparse.urlparse(self.url).path
        return path.split('/')[2]


class AirbnbScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)://www\.airbnb\.(com|[a-z]{2})(\.[a-z]{2})?/rooms/\d+.*$',
        ('^http(s)://www\.airbnb\.(com|[a-z]{2})(\.[a-z]{2})?/s/.*$',
            scraped_page.result_page_expander('.//div[contains(@class, "search-results")]//div[contains(@class, "listing")]//div[contains(@class, "listing-info")]//a'),
            False, REQUIRES_CLIENT_PAGE_SOURCE))

    NAME_XPATH = 'body//div[@id="listing_name"]'
    ADDRESS_XPATH = 'body//div[@id="room"]//span[@id="display-address"]'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="photos"]//ul[@class="slideshow-images"]//li[@class="active"]//img'

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

class HyattScraper(scraped_page.ScrapedPage):
    NAME_XPATH = 'body//h1[@class="homePropertyName"]'

    def get_address(self):
        elems = self.root.findall('body//div[@class="addresspanel"]//p[@class="address"]')
        return '%s %s' % (tostring(elems[0], True), tostring(elems[1], True)) 

    def get_primary_photo(self):
        return self.absolute_url(self.root.find('body//div[@id="mastHeadCarousel"]//li//img').get('data-original'))

    def get_photos(self):
        return [self.absolute_url(e.get('data-original')) for e in self.root.findall('body//div[@id="mastHeadCarousel"]//li//img')]

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    @staticmethod
    def expand_reservation_page(url, page_source_tree):
        new_url = page_source_tree.getroot().find('body//li[@class="img_info"]//p[@class="bw"]//a').get('href')
        return (new_url,)

    @staticmethod
    def expand_deep_info_page(url, ignored):
        host = urlparse.urlparse(url).netloc.lower()
        new_url = 'http://%s/en/hotel/home.html' % host
        return (new_url,)

HyattScraper.HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
    '^http(s)?://[^/]+\.hyatt.com/[a-z]+/hotel/home.html.*$',
    ('^http(s)?://[^/]+\.hyatt.com/hyatt/reservations.*$', HyattScraper.expand_reservation_page, False, REQUIRES_CLIENT_PAGE_SOURCE),
    ('^http(s)?://[^/]+\.hyatt.com/[a-z]+/hotel/(?!home).*$', HyattScraper.expand_deep_info_page))


class StarwoodScraper(scraped_page.ScrapedPage):
    NAME_XPATH = 'body//div[@id="propertyInformation"]//h1'

    def get_address(self):
        addr_root = self.root.find('body//ul[@id="propertyAddress"]')
        return html_parsing.join_element_text_using_xpaths(addr_root, (
            './/li[@class="street-address"]', './/li[@class="city"]',
            './/li[@class="region"]', './/li[@class="postal-code"]',
            './/li[@class="country-name"]'))

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    @fail_returns_none
    def get_rating(self):
        return float(self.root.find('body//span[@itemprop="aggregateRating"]//span[@itemprop="ratingValue"]').text)

    def get_photos(self):
        photo_page = self.get_photo_page()
        thumbs = photo_page.findall('.//div[@class="photoSection"]//div[@class="thumbs"]//img')
        photo_page_url = self.get_photo_page_url()
        thumb_srcs = [urlparse.urljoin(photo_page_url, thumb.get('src')) for thumb in thumbs]
        return [thumb.replace('_tn.jpg', '_lg.jpg') for thumb in thumb_srcs if '_tn.jpg' in thumb]

    def get_photo_page_url(self):
        return 'http://www.starwoodhotels.com/preferredguest/property/photos/index.html?propertyID=%s' % self.get_site_specific_entity_id()

    def get_photo_page(self):
        if not hasattr(self, '_photo_page'):
            self._photo_page = html_parsing.parse_tree(self.get_photo_page_url())
        return self._photo_page

    def get_primary_photo(self):
        photo_url_re = re.compile('''entity\.thumbnailUrl=([^'",]+)''')        
        for script in self.root.findall('body//script'):
            match = photo_url_re.search(script.text)
            if match:
                return self.absolute_url(match.group(1).replace('_tn.jpg', '_lg.jpg'))
        return None

    def get_site_specific_entity_id(self):
        return urlparse.parse_qs(urlparse.urlparse(self.url.lower()).query)['propertyid'][0]

    @staticmethod
    def expand_using_property_id(url, ignored):
        property_id = urlparse.parse_qs(urlparse.urlparse(url.lower()).query)['propertyid'][0]
        new_url = 'http://www.starwoodhotels.com/preferredguest/property/overview/index.html?propertyID=%s' % property_id
        return (new_url,)

StarwoodScraper.HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
    '^http(s)?://www\.starwoodhotels\.com/preferredguest/property/overview/index\.html\?propertyID=\d+.*$',
    ('(?i)^http(s)?://www\.starwoodhotels\.com/.*propertyid=\d+.*$', StarwoodScraper.expand_using_property_id))


class HiltonScraper(scraped_page.ScrapedPage):
    NAME_XPATH = 'body//h1'

    def get_address(self):
        return tostring(self.root.find('body//span[@itemprop="address"]'), True)

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    def get_primary_photo(self):
        return self.get_photos()[0]

    def get_photos(self):
        elems = self.root.findall('body//div[@class="galleryCarousel"]//img')
        urls = [self.absolute_url(elem.get('src')) for elem in elems]
        return [self.fix_image_url(url) for url in urls]

    def fix_image_url(self, url):
        url = url.replace('/thumb/', '/main/')
        if '81x50' in url:
            url = url.replace('81x50', '675x359')
        else:
            url = url.replace('.jpg', '_675x359_FitToBoxSmallDimension_Center.jpg')
        return url


    INFO_PAGE_RE = re.compile('^http(?:s)?://www(?:\d)?\.hilton\.com/([a-z]+)/hotels/([\w-]+)/([\w-]+)/[\w-]+/[\w-]+\.html.*$')

    @staticmethod
    def expand_info_page_url(url, ignored):
        match = HiltonScraper.INFO_PAGE_RE.match(url)
        language, region, property_name = match.group(1), match.group(2), match.group(3)
        new_url = 'http://www3.hilton.com/%s/hotels/%s/%s/index.html' % (language, region, property_name)
        return (new_url,)

    @staticmethod
    def expand_reservation_page(url, page_source_tree):
        details_popup = page_source_tree.getroot().find('body//div[@class="resHeaderHotelInfo"]//span[@class="links"]//a[@class="popup"]')
        if details_popup is not None:
            details_url = details_popup.get('href')
            new_url = details_url.replace('/popup/hotelDetails.html', '/index.html')
            return (new_url,)
        return ()

HiltonScraper.HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
    '^http(s)?://www(\d)?\.hilton\.com/[a-z]+/hotels/[\w-]+/[\w-]+/index\.html.*$',
    ('^http(s)?://www(\d)?\.hilton\.com/[a-z]+/hotels/[\w-]+/[\w-]+/[\w-]+/[\w-]+\.html.*$', HiltonScraper.expand_info_page_url),
    ('^http(s)?://secure(\d)?\.hilton\.com/.*$', HiltonScraper.expand_reservation_page, False, REQUIRES_CLIENT_PAGE_SOURCE))


class LonelyPlanetScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '(?i)^http(s)?://www\.lonelyplanet\.com/[^/]+/[^/]+/hotels/(?!guesthouse|apartments|rated|hostels-and-budget-hotels).*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/[^/]+/[^/]+/shopping/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/[^/]+/[^/]+/entertainment-nightlife/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/[^/]+/[^/]+/sights/.*$',
        '(?i)^http(s)?://www\.lonelyplanet\.com/[^/]+/[^/]+/restaurants/.*$',)

    NAME_XPATH = './/h1'

    def get_address(self):
        city, country = self.get_city_and_country()
        if '/hotels/' in self.url:
            street_and_city_node = self.root.find('.//div[@class="vcard lodging__subtitle"]')
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
            hotel_type_node = self.root.find('.//div[@class="lodging__subtitle"]')
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

    def get_rating(self):
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

    def get_photos(self):
        urls = []
        try:
            for img in self.root.findall('.//img[@class="media-gallery__img"]'):
                urls.append(img.get('src'))
            for img in self.root.findall('.//img[@data-class="media-gallery__img"]'):
                urls.append(img.get('data-src'))
        except:
            pass
        if not urls:
            google_place_entity = self.lookup_google_place()
            if google_place_entity:
                urls.extend(google_place_entity.photo_urls)
        return urls

    def get_latlng(self):
        google_place_entity = self.lookup_google_place()
        if google_place_entity:
            return google_place_entity.latlng.to_json_obj() if google_place_entity.latlng else None
        return None

    def get_location_precision(self):
        return 'Precise' if self.get_latlng() else 'Imprecise'

# Only supports review pages
class FodorsScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.fodors\.com/.*/review-\d+\.html.*$',)

    NAME_XPATH = './/h1'

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

    # Convert Fodor's star rating (represented as % of 100%) to normalized scale
    def get_rating(self):
        rating_value_node = self.root.find('.//span[@class="ratings-value star5"]')
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


class WikipediaScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://[a-z]{2,3}\.wikipedia\.org/wiki/.+$')

    NAME_XPATH = './/h1[@id="firstHeading"]//span'
    PRIMARY_PHOTO_XPATH = './/table[@class="infobox vcard"]//a[@class="image"]//img'

    @fail_returns_none
    def get_address(self):
        infocard_cells = self.root.findall('.//table[@class="infobox vcard"]//tr')
        for tr in infocard_cells:
            th = tr.find('.//th')
            if th is not None and th.text == 'Address':
                return tostring(tr.find('.//td'))
        return None

    def get_category(self):
        return values.Category.ATTRACTIONS

    def parse_latlng(self):
        lat_elem = self.root.find('.//span[@class="geo-default"]//span[@class="latitude"]')
        lng_elem = self.root.find('.//span[@class="geo-default"]//span[@class="longitude"]')
        if lat_elem is not None:
            return utils.latlng_to_decimal(tostring(lat_elem), tostring(lng_elem))
        geo_elem = self.root.find('.//span[@class="geo-default"]//span[@class="geo"]')
        if geo_elem is not None:
            lat, lng = tostring(geo_elem).split(';')
            return {
                'lat': float(lat.strip()),
                'lng': float(lng.strip())
                }
        return None

    @fail_returns_none
    def get_location_precision(self):
        if self.parse_latlng():
            return 'Precise'
        return super(WikipediaScraper, self).get_location_precision()

    @fail_returns_none
    def get_photos(self):
        img_urls = []
        imgs = self.root.findall('.//a[@class="image"]//img')
        for img in imgs:
            if img.get('alt') and 'icon' in img.get('alt').lower():
                continue
            srcset = img.get('srcset')
            if srcset:
                largest_src = srcset.split(',')[-1].strip().split(' ')[0]
                img_urls.append(largest_src)
        return img_urls

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


from scrapers import hotels_dot_com
from scrapers import tripadvisor

ALL_SCRAPERS = (hotels_dot_com.HotelsDotComScraper, tripadvisor.TripAdvisorScraper) \
    + tuple(val for val in locals().itervalues() if type(val) == type and issubclass(val, scraped_page.ScrapedPage))

def build_scrapers(url, client_page_source=None, force_fetch_page=False, allow_expansion=True):
    page_source_tree = html_parsing.parse_tree_from_string(client_page_source) if client_page_source else None
    if not page_source_tree and (url_requires_server_page_source(url) or force_fetch_page):
        page_source_tree = html_parsing.parse_tree(url)

    scraped_pages = []
    for scraper_class in ALL_SCRAPERS:
        handleable_urls = scraper_class.handleable_urls(url, page_source_tree, allow_expansion)
        if handleable_urls:
            reqs = [html_parsing.make_request(u) for u in handleable_urls]
            resps = utils.parallelize(utils.retryable(urllib2.urlopen, 3), [(req,) for req in reqs])
            for url, resp in zip(handleable_urls, resps):
                if not resp:
                    print 'Failed to fetch url: %s' % url
                    continue
                tree = etree.parse(resp, html_parsing.htmlparser())
                scraper = scraper_class(url, tree)
                scraped_pages.append(scraper)
            break
    return scraped_pages

def build_scraper(url, page_source=None):
    scrapers = build_scrapers(url, page_source)
    return scrapers[0] if scrapers else None

def url_requires_client_page_source(url):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.url_requires_client_page_source(url):
            return True
    return False

def url_requires_server_page_source(url):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.url_requires_server_page_source(url):
            return True
    return False

def is_url_handleable(url, allow_expansion=True):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.is_url_handleable(url, allow_expansion):
            return True
    return False

if __name__ == '__main__':
    from tests.testdata import scraper_page_source
    for url in (
        'http://www.tripadvisor.com/Hotel_Review-g298570-d301416-Reviews-Mandarin_Oriental_Kuala_Lumpur-Kuala_Lumpur_Wilayah_Persekutuan.html',
        'http://www.tripadvisor.com/Hotel_Review-g60713-d224953-Reviews-Four_Seasons_Hotel_San_Francisco-San_Francisco_California.html',
        'http://www.tripadvisor.com/Restaurant_Review-g60616-d1390699-Reviews-Hukilau_Lanai-Kapaa_Kauai_Hawaii.html',
        'http://www.tripadvisor.com/Attractions-g255060-Activities-Sydney_New_South_Wales.html',
        'http://www.yelp.com/biz/mandarin-oriental-san-francisco-san-francisco-4',
        'http://www.yelp.com/biz/ikes-place-san-francisco',
        'http://www.hotels.com/hotel/details.html?tab=description&hotelId=336749',
        'http://www.hotels.com/hotel/details.html?pa=1&pn=1&ps=1&tab=description&destinationId=1493604&searchDestination=San+Francisco&hotelId=108742&rooms[0].numberOfAdults=2&roomno=1&validate=false&previousDateful=false&reviewOrder=date_newest_first',
        'http://www.hotels.com/ho276485/hotel-banke-paris-france/?gclid=CIHStK3B470CFc1afgodSjMAVg&hotelid=276485&PSRC=G21&rffrid=sem.hcom.US.google.003.03.02.s.kwrd%3DZzZz.s1lKbc1kl.0.33721657110.10205l017840.d.c',
        # 'http://www.hotels.com/search.do?current-location=Kuala+Lumpur%2C+Malaysia&arrivalDate=&departureDate=&searchParams.rooms.compact_occupancy_dropdown=compact_occupancy_1_2&rooms=1&searchParams.rooms%5B0%5D.numberOfAdults=2&children%5B0%5D=0&srsReport=HomePage%7CAutoS%7Ccity%7Cchicago%7C6%7C3%7C3%7C3%7C1%7C15%7C1497539&pageName=HomePage&searchParams.landmark=&resolvedLocation=CITY%3A1497539%3APROVIDED%3APROVIDED#pageName=SearchResultPage&dn=Chicago,+Illinois,+United+States&nr=1&pn=1&upn=0&so=BEST_SELLER&vt=LIST&rl=CITY%3A1497539%3APROVIDED%3APROVIDED&pfm=1&pfcc=USD&maxp=500&sr%5B%5D=5&sr%5B%5D=4&ming=4&r=2&cpr=0,'
        'https://www.airbnb.com/rooms/2407670',
        'https://www.airbnb.com/rooms/2576604',
        'https://www.airbnb.com/rooms/1581737',
        'http://www.booking.com/hotel/my/mandarin-oriental-kuala-lumpur.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1;checkin=2014-05-03;interval=1',
        'http://www.booking.com/hotel/fr/st-christopher-s-inn-paris-gare-du-nord.en-us.html',
        'http://www.booking.com/hotel/us/candlelight-inn-bed-and-breakfast.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1',
        'https://www.hyatt.com/hyatt/reservations/roomsAndRates.jsp?xactionid=145482245a8&_requestid=972056',
        'http://regencyboston.hyatt.com/en/hotel/home.html',
        'http://bangalore.hyatthotels.hyatt.com/en/hotel/dining.html',
        'http://www.starwoodhotels.com/preferredguest/property/overview/index.html?propertyID=1153',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=1488',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=250',
        'http://www3.hilton.com/en/hotels/illinois/hilton-chicago-CHICHHH/index.html',
        'http://www3.hilton.com/en/hotels/france/concorde-opra-paris-PAROPHI/index.html',
        'http://www3.hilton.com/en/hotels/united-kingdom/the-trafalgar-london-LONTSHI/accommodations/index.html',
        'https://secure3.hilton.com/en_US/hi/reservation/book.htm?execution=e3s1',
        'http://www3.hilton.com/en/hotels/ohio/hilton-akron-fairlawn-CAKHWHF/index.html',
        'http://www.lonelyplanet.com/usa/san-francisco/restaurants/american/benu',
        'http://www.lonelyplanet.com/spain/barcelona/hotels/hostal-abrevadero',
        'http://www.lonelyplanet.com/kenya/wasini-island/sights/nature-wildlife/kisite-marine-national-park',
        'http://www.lonelyplanet.com/spain/barcelona/entertainment-nightlife/other/la-caseta-del-migdia',
        'http://www.lonelyplanet.com/united-arab-emirates/dubai/shopping/markets-streets-arcades/fish-market',
        'http://www.fodors.com/world/europe/italy/rome/review-472395.html',
        'http://www.fodors.com/world/north-america/usa/california/san-francisco/review-577818.html',
        'http://www.fodors.com/world/caribbean/us-virgin-islands/st-thomas/review-153132.html',
        'http://www.fodors.com/world/south-america/ecuador/the-galapagos-islands/review-449176.html',
        'http://www.fodors.com/world/europe/spain/barcelona/review-164246.html',
        'http://www.fodors.com/world/africa-and-middle-east/kenya/review-586358.html',
        'http://www.fodors.com/world/europe/italy/rome/review-38440.html',
        'http://en.wikipedia.org/wiki/San_Francisco_Ferry_Building',
        'http://en.wikipedia.org/wiki/Eiffel_tower',
        'http://en.wikipedia.org/wiki/Bahnhofstrasse',
        'https://foursquare.com/v/pacific-catch-9th-ave-san-francisco-ca/49dd5b31f964a520fe5f1fe3',
        ):
        scrapers = build_scrapers(url, scraper_page_source.get_page_source(url))
        for scraper in scrapers:
            print scraper.debug_string()
            print scraper.get_latlng()
            print scraper.get_location_precision()
        print '-----'
