import cStringIO
import decimal
import json
import re
import string
import urllib2
import urlparse

from lxml import etree

import crossreference
import geocode
import values

USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36'

def fail_returns_none(fn):
    def wrapped(self):
        try:
            return fn(self)
        except:
            return None
    return wrapped

def fail_returns_empty(fn):
    def wrapped(self):
        try:
            return fn(self)
        except:
            return ()
    return wrapped

class LocationResolutionStrategy(object):
    ADDRESS = 1
    ENTITY_NAME_WITH_GEOCODER = 2
    ENTITY_NAME_WITH_PLACE_SEARCH = 3

    def __init__(self, ordered_choices):
        self.ordered_choices = tuple(ordered_choices)

    @classmethod
    def from_options(cls, *choices):
        return LocationResolutionStrategy(choices)


class ScrapedPage(object):
    PAGE_TITLE_XPATH = 'head/title'
    NAME_XPATH = None
    ADDRESS_XPATH = None
    PRIMARY_PHOTO_XPATH = None

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ADDRESS)

    def __init__(self, url, tree):
        self.url = url
        self.tree = tree
        self.root = tree.getroot()
        self._location = None

    @fail_returns_none
    def get_page_title(self):
        return self.root.find(self.PAGE_TITLE_XPATH).text.strip()

    @fail_returns_none
    def get_entity_name(self):
        return tostring(self.root.find(self.NAME_XPATH))

    @fail_returns_none
    def get_address(self):
        addr_elem = self.root.find(self.ADDRESS_XPATH)
        return tostring_with_breaks(addr_elem).strip()

    @fail_returns_none
    def get_category(self):
        return None

    @fail_returns_none
    def get_sub_category(self):
        return None

    @fail_returns_none
    def get_rating(self):
        return ''

    @fail_returns_none
    def get_primary_photo(self):
        return self.root.find(self.PRIMARY_PHOTO_XPATH).get('src')

    @fail_returns_empty
    def get_photos(self):
        return ()

    @fail_returns_none
    def get_site_specific_entity_id(self):
        return None

    def get_latlng(self):
        parsed_latlng = self.parse_latlng()
        if parsed_latlng:
            return parsed_latlng
        location = self.lookup_location()
        if location:
            return location.latlng_json()
        return None

    def parse_latlng(self):
        return None

    def lookup_location(self):
        if not self._location:
            self._location = lookup_location(self)
        return self._location

    def get_location_precision(self):
        location = self.lookup_location()
        return 'Precise' if location and location.is_precise() else 'Imprecise'

    def is_base_scraper(self):
        return type(self) == ScrapedPage

    def absolute_url(self, relative_url):
        return urlparse.urljoin(self.url, relative_url)

    def debug_string(self):
        return '''
Entity name: %s
Category: %s
SubCategory: %s
Address: %s
Rating: %s
Primary photo url: %s
Photo urls: %s''' % (
    self.get_entity_name(),
    self.get_category(),
    self.get_sub_category(),
    self.get_address(),
    self.get_rating(),
    self.get_primary_photo(),
    self.get_photos())

class TripAdvisorScraper(ScrapedPage):
    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address/span[@rel="v:address"]//span[@class="format_address"]'

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
    def get_rating(self):
        return self.root.find('body//div[@rel="v:rating"]//img').get('content')

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
        if self.get_category == values.Category.LODGING:
            hotelsdotcom_url = crossreference.find_hotelsdotcom_url(self.get_entity_name())
            if hotelsdotcom_url:
                additional_urls = build_scraper(hotelsdotcom_url).get_photos()
                urls.extend(additional_urls)
        return urls


class YelpScraper(ScrapedPage):
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
        return self.root.find('body//meta[@itemprop="ratingValue"]').get('content')

    @fail_returns_none
    def get_primary_photo(self):
        return super(YelpScraper, self).get_primary_photo().replace('ls.jpg', 'l.jpg')

    @fail_returns_empty
    def get_photos(self):
        urls = []
        photo_page_url = 'http://www.yelp.com/biz_photos/' + self.get_site_specific_entity_id()
        photos_root = parse_tree(photo_page_url).getroot()
        for thumb_img in photos_root.findall('body//div[@id="photo-thumbnails"]//a/img'):
            urls.append(thumb_img.get('src').replace('ms.jpg', 'l.jpg'))
        return urls

    @fail_returns_none
    def get_site_specific_entity_id(self):
        path = urlparse.urlparse(self.url).path
        return path.split('/')[2]


class HotelsDotComScraper(ScrapedPage):
    NAME_XPATH = 'body//h1'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="hotel-photos"]//div[@class="slide active"]//img'

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ADDRESS, LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH)

    @fail_returns_none
    def get_address(self):
        addr_parent = self.root.find('body//div[@class="address-cntr"]/span[@class="adr"]')
        street_addr = tostring_with_breaks(addr_parent.find('span[@class="street-address"]')).strip()
        street_addr = re.sub('\s+', ' ', street_addr)
        postal_addr = tostring_with_breaks(addr_parent.find('span[@class="postal-addr"]')).strip()
        postal_addr = re.sub('\s+', ' ', postal_addr)
        country = tostring_with_breaks(addr_parent.find('span[@class="country-name"]')).strip().strip(',')
        return '%s %s %s' % (street_addr, postal_addr, country)

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    @fail_returns_none
    def get_rating(self):
        # Looks like "4.5 / 5"
        rating_fraction_str = etree.tostring(self.root.find('body//div[@class="score-summary"]/span[@class="rating"]'), encoding='unicode', method='text').strip()
        return rating_fraction_str.split('/')[0].strip()

    @fail_returns_empty
    def get_photos(self):
        carousel_thumbnails = self.root.findall('body//div[@id="hotel-photos"]//ol[@class="thumbnails"]//li//a')
        return [thumb.get('href') for thumb in carousel_thumbnails]

class AirbnbScraper(ScrapedPage):
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
        return self.root.find('body//div[@id="room"]//meta[@itemprop="ratingValue"]').get('content')

    @fail_returns_empty
    def get_photos(self):
        thumbs = self.root.findall('body//div[@id="photos"]//div[@class="thumbnails-viewport"]//li//a')
        return [thumb.get('href') for thumb in thumbs]


class BookingDotComScraper(ScrapedPage):
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

    def get_rating(self):
        numerator = float(self.root.find('body//div[@class="hotel_large_photp_score"]//span[@class="rating"]//span[@class="average"]').text)
        denominator = int(self.root.find('body//div[@class="hotel_large_photp_score"]//span[@class="rating"]//span[@class="best"]').text)
        return numerator / denominator * 5

    def get_photos(self):
        thumbs = self.root.findall('body//div[@id="photos_distinct"]//a[@data-resized]')
        return [thumb.get('data-resized') for thumb in thumbs]

class HyattInfoPageScraper(ScrapedPage):
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

class HyattRatesPageScraper(ScrapedPage):
    NAME_XPATH = 'body//div[@id="logoCarouselAlter"]//a'
    PRIMARY_PHOTO_XPATH = 'body//li[@class="img_holder"]//img'

    def get_address(self):
        elems = self.root.findall('body//li[@class="img_info"]//p[@class="dim"]')
        return '%s %s' % (tostring(elems[0], True), tostring(elems[1], True))

    def get_category(self):
        return values.Category.LODGING

    def get_sub_category(self):
        return values.SubCategory.HOTEL

    def get_photos(self):
        return self.get_info_page().get_photos()

    def get_info_page(self):
        if hasattr(self, '_info_page'):
            return self.info_page
        info_page_url = self.root.find('body//li[@class="img_info"]//p[@class="bw"]//a').get('href')
        self._info_page = build_scraper(info_page_url)
        return self._info_page

class StarwoodScraper(ScrapedPage):
    NAME_XPATH = 'body//div[@id="propertyInformation"]//h1'

    @staticmethod
    def canonical_url(url):
        property_id = urlparse.parse_qs(urlparse.urlparse(url.lower()).query)['propertyid'][0]
        return 'http://www.starwoodhotels.com/preferredguest/property/overview/index.html?propertyID=%s' % property_id

    def __init__(self, url, tree):
        super(StarwoodScraper, self).__init__(url, tree)
        if 'starwoodhotels.com/preferredguest' not in url.lower():
            self.tree = parse_tree(StarwoodScraper.canonical_url(url))
            self.root = self.tree.getroot()

    def get_address(self):
        addr_root = self.root.find('body//ul[@id="propertyAddress"]')
        return join_element_text_using_xpaths(addr_root, (
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
            self._photo_page = parse_tree(self.get_photo_page_url())
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

def tostring_with_breaks(element):
    raw_html = etree.tostring(element)
    elem = element
    if '<br/>' in raw_html or '<br>' in raw_html:
        modified_html = raw_html.replace('<br/>', '<br/> ').replace('<br>', '<br> ')
        elem = etree.fromstring(modified_html)
    return etree.tostring(elem, encoding='unicode', method='text').strip(string.punctuation).strip()

def tostring(element, normalize_whitespace=False):
    s = etree.tostring(element, encoding='unicode', method='text').strip()
    if normalize_whitespace:
        return re.sub('\s+', ' ', s)
    return s

def join_element_text_using_xpaths(root, xpaths, separator=' '):
    elems = texts = [root.find(xpath) for xpath in xpaths]
    texts = [tostring(elem) for elem in elems if elem is not None]
    return separator.join(texts)

def parse_tree(url, page_source=None):
    if page_source:
        html = cStringIO.StringIO(page_source)
    else:
        req = urllib2.Request(url, headers={'User-Agent': USER_AGENT})
        html = urllib2.urlopen(req)
    parser = etree.HTMLParser()
    tree = etree.parse(html, parser)
    return tree

def build_scraper(url, page_source=None):
    tree = parse_tree(url, page_source)
    parsed = urlparse.urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()
    scraper_class = ScrapedPage
    if 'tripadvisor.com' in host:
        scraper_class = TripAdvisorScraper
    elif 'yelp.com' in host:
        scraper_class = YelpScraper
    elif 'starwoodhotels.com' in host:
        scraper_class = StarwoodScraper
    # TODO: This catches *hotels.com which is wrong and dangerous.
    # Switch to a regex-based matcher.
    elif 'hotels.com' in host:
        scraper_class = HotelsDotComScraper
    elif 'airbnb.com' in host:
        scraper_class = AirbnbScraper
    elif 'booking.com' in host:
        scraper_class = BookingDotComScraper
    elif 'hyatt.com' in host:
        if '/hyatt/reservations' in path:
            scraper_class = HyattRatesPageScraper
        else:
            scraper_class = HyattInfoPageScraper
    return scraper_class(url, tree)

def lookup_location(scr):
    locations = []
    for option in scr.LOCATION_RESOLUTION_STRATEGY.ordered_choices:
        if option == LocationResolutionStrategy.ADDRESS:
            location = geocode.lookup_latlng(scr.get_address())
            if location:
                locations.append(location)
        elif option == LocationResolutionStrategy.ENTITY_NAME_WITH_GEOCODER:
            location = geocode.lookup_latlng(scr.get_entity_name())
            if location:
                locations.append(location)
        elif option == LocationResolutionStrategy.ENTITY_NAME_WITH_PLACE_SEARCH:
            location = geocode.lookup_place(scr.get_entity_name())
            if location:
                locations.append(location)
    return pick_best_location(locations, scr.get_entity_name())

def pick_best_location(locations, entity_name):
    if not locations:
        return None
    for location in locations:
        if location.is_clear_match(entity_name):
            return location
    for location in locations:
        if location.is_name_match(entity_name):
            return location
    for location in locations:
        if location.is_precise():
            return location
    return locations[0]

if __name__ == '__main__':
    from tests.testdata import scraper_page_source
    for url in (
        'http://www.tripadvisor.com/Hotel_Review-g298570-d301416-Reviews-Mandarin_Oriental_Kuala_Lumpur-Kuala_Lumpur_Wilayah_Persekutuan.html',
        'http://www.tripadvisor.com/Hotel_Review-g60713-d224953-Reviews-Four_Seasons_Hotel_San_Francisco-San_Francisco_California.html',
        'http://www.tripadvisor.com/Restaurant_Review-g60616-d1390699-Reviews-Hukilau_Lanai-Kapaa_Kauai_Hawaii.html',
        'http://www.yelp.com/biz/mandarin-oriental-san-francisco-san-francisco-4',
        'http://www.yelp.com/biz/ikes-place-san-francisco',
        'http://www.hotels.com/hotel/details.html?tab=description&hotelId=336749',
        'http://www.hotels.com/hotel/details.html?pa=1&pn=1&ps=1&tab=description&destinationId=1493604&searchDestination=San+Francisco&hotelId=108742&rooms[0].numberOfAdults=2&roomno=1&validate=false&previousDateful=false&reviewOrder=date_newest_first',
        'https://www.airbnb.com/rooms/2407670',
        'https://www.airbnb.com/rooms/2576604',
        'https://www.airbnb.com/rooms/1581737',
        'http://www.booking.com/hotel/my/mandarin-oriental-kuala-lumpur.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1;checkin=2014-05-03;interval=1',
        'http://www.booking.com/hotel/fr/st-christopher-s-inn-paris-gare-du-nord.en-us.html',
        'http://www.booking.com/hotel/us/candlelight-inn-bed-and-breakfast.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1',
        'https://www.hyatt.com/hyatt/reservations/roomsAndRates.jsp?xactionid=145482245a8&_requestid=972056',
        'http://regencyboston.hyatt.com/en/hotel/home.html',
        'http://www.starwoodhotels.com/preferredguest/property/overview/index.html?propertyID=1153',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=1488',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=250',
        ):
        scraper = build_scraper(url, scraper_page_source.get_page_source(url))
        print scraper.debug_string()
        print scraper.get_latlng()
        print scraper.get_location_precision()
        print '-----'
