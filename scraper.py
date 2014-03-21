import json
import re
import urllib2
import urlparse

from lxml import etree

def fail_returns_none(fn):
    def wrapped(self):
        try:
            return fn(self)
        except:
            return None
    return wrapped

class ScrapedPage(object):
    PAGE_TITLE_XPATH = 'head/title'
    NAME_XPATH = None
    ADDRESS_XPATH = None
    ENTITY_TYPE_XPATH = None
    PRIMARY_PHOTO_XPATH = None

    def __init__(self, url, tree):
        self.url = url
        self.tree = tree
        self.root = tree.getroot()

    @fail_returns_none
    def get_page_title(self):
        return self.root.find(self.PAGE_TITLE_XPATH).text.strip()

    @fail_returns_none
    def get_entity_name(self):
        return self.root.find(self.NAME_XPATH).text.strip()

    @fail_returns_none
    def get_address(self):
        addr_elem = self.root.find(self.ADDRESS_XPATH)
        return tostring_with_breaks(addr_elem).strip()

    @fail_returns_none
    def get_address_precision(self):
        return 'Precise'

    @fail_returns_none
    def get_entity_type(self):
        return self.root.find(self.ENTITY_TYPE_XPATH).text.strip()

    @fail_returns_none
    def get_rating(self):
        return ''

    @fail_returns_none
    def get_primary_photo(self):
        return self.root.find(self.PRIMARY_PHOTO_XPATH).get('src')

    def is_base_scraper(self):
        return type(self) == ScrapedPage

    def debug_string(self):
        return '''
Entity name: %s
Entity type: %s
Address: %s
Rating: %s
Primary photo url: %s
        ''' % (self.get_entity_name(),
            self.get_entity_type(),
            self.get_address(),
            self.get_rating(),
            self.get_primary_photo())

class TripAdvisorScraper(ScrapedPage):
    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address/span[@rel="v:address"]//span[@class="format_address"]'
    ENTITY_TYPE_XPATH = 'body//address//span[@class="placeTypeText"]'

    @fail_returns_none
    def get_entity_type(self):
        if '/Hotel_Review' in self.url:
            return 'Hotel'
        elif '/Restaurant_Review' in self.url:
            return 'Restaurant'
        elif '/Attraction_Review' in self.url:
            return 'Attraction'
        return super(TripAdvisorScraper, self).get_entity_type()

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


class YelpScraper(ScrapedPage):
    NAME_XPATH = 'body//h1'
    ADDRESS_XPATH = 'body//address[@itemprop="address"]'
    PRIMARY_PHOTO_XPATH = 'body//div[@class="showcase-photos"]//div[@class="showcase-photo-box"]//img'

    @fail_returns_none
    def get_entity_type(self):
        categories_parent = self.root.find('body//span[@class="category-str-list"]')
        categories_str = etree.tostring(categories_parent, method='text')
        categories = [c.strip().lower() for c in categories_str.split(',')]
        if 'hotel' in categories or 'hotels' in categories:
            return 'Hotel'
        else:
            return 'Restaurant'

    @fail_returns_none
    def get_rating(self):
        return self.root.find('body//meta[@itemprop="ratingValue"]').get('content')

    @fail_returns_none
    def get_primary_photo(self):
        return super(YelpScraper, self).get_primary_photo().replace('ls.jpg', 'l.jpg')

class HotelsDotComScraper(ScrapedPage):
    NAME_XPATH = 'body//h1'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="hotel-photos"]//div[@class="slide active"]//img'

    @fail_returns_none
    def get_address(self):
        addr_parent = self.root.find('body//div[@class="address-cntr"]/span[@class="adr"]')
        street_addr = tostring_with_breaks(addr_parent.find('span[@class="street-address"]')).strip()
        street_addr = re.sub('\s+', ' ', street_addr)
        postal_addr = tostring_with_breaks(addr_parent.find('span[@class="postal-addr"]')).strip()
        postal_addr = re.sub('\s+', ' ', postal_addr)
        country = tostring_with_breaks(addr_parent.find('span[@class="country-name"]')).strip().strip(',')
        return '%s %s %s' % (street_addr, postal_addr, country)

    def get_entity_type(self):
        return 'Hotel'

    @fail_returns_none
    def get_rating(self):
        # Looks like "4.5 / 5"
        rating_fraction_str = etree.tostring(self.root.find('body//div[@class="score-summary"]/span[@class="rating"]'), method='text').strip()
        return rating_fraction_str.split('/')[0].strip()

class AirbnbScraper(ScrapedPage):
    NAME_XPATH = 'body//div[@id="listing_name"]'
    ADDRESS_XPATH = 'body//div[@id="room"]//span[@id="display-address"]'
    PRIMARY_PHOTO_XPATH = 'body//div[@id="photos"]//ul[@class="slideshow-images"]//li[@class="active"]//img'

    @fail_returns_none
    def get_entity_name(self):
        return 'Airbnb: ' + super(AirbnbScraper, self).get_entity_name()

    def get_entity_type(self):
        # TODO: Changing to 'Lodging' and add a subtype
        return 'Hotel'

    @fail_returns_none
    def get_address_precision(self):
        return 'Imprecise'

    @fail_returns_none
    def get_rating(self):
        return self.root.find('body//div[@id="room"]//meta[@itemprop="ratingValue"]').get('content')


def tostring_with_breaks(element):
    modified_html = etree.tostring(element).replace('<br/>', '<br/> ').replace('<br>', '<br> ')
    new_element = etree.fromstring(modified_html)
    return etree.tostring(new_element, method='text')

def parse_tree(url):
    html = urllib2.urlopen(url)
    parser = etree.HTMLParser()
    tree = etree.parse(html, parser)
    return tree

def build_scraper(url):
    tree = parse_tree(url)
    host = urlparse.urlparse(url).netloc.lower()
    scraper_class = ScrapedPage
    if 'tripadvisor.com' in host:
        scraper_class = TripAdvisorScraper
    elif 'yelp.com' in host:
        scraper_class = YelpScraper
    elif 'hotels.com' in host:
        scraper_class = HotelsDotComScraper
    elif 'airbnb.com' in host:
        scraper_class = AirbnbScraper
    return scraper_class(url, tree)

if __name__ == '__main__':
    for url in (
            'http://www.tripadvisor.com/Hotel_Review-g298570-d301416-Reviews-Mandarin_Oriental_Kuala_Lumpur-Kuala_Lumpur_Wilayah_Persekutuan.html',
            'http://www.tripadvisor.com/Hotel_Review-g60713-d224953-Reviews-Four_Seasons_Hotel_San_Francisco-San_Francisco_California.html',
            'http://www.tripadvisor.com/Restaurant_Review-g60616-d1390699-Reviews-Hukilau_Lanai-Kapaa_Kauai_Hawaii.html',
            'http://www.yelp.com/biz/mandarin-oriental-san-francisco-san-francisco-4',
            'http://www.yelp.com/biz/ikes-place-san-francisco',
            'http://www.hotels.com/hotel/details.html?tab=description&hotelId=336749',
            'http://www.hotels.com/hotel/details.html?pa=1&pn=1&ps=1&tab=description&destinationId=1493604&searchDestination=San+Francisco&hotelId=108742&rooms[0].numberOfAdults=2&roomno=1&validate=false&previousDateful=false&reviewOrder=date_newest_first',
            'https://www.airbnb.com/rooms/2407670',
            'https://www.airbnb.com/rooms/2576604'):
        scraper = build_scraper(url)
        print scraper.debug_string()
