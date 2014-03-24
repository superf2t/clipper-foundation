import re
import urlparse

from selenium import webdriver

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

    def __init__(self, url, browser):
        self.url = url
        self.browser = browser
        browser.get(url)

    def tear_down(self):
        self.browser.close()

    def xpath(self, xpath):
        return self.browser.find_element_by_xpath(xpath)

    @fail_returns_none
    def get_page_title(self):
        return self.xpath(self.PAGE_TITLE_XPATH).text.strip()

    @fail_returns_none
    def get_entity_name(self):
        return self.xpath(self.NAME_XPATH).text.strip()

    @fail_returns_none
    def get_address(self):
        return re.sub('\n+', ' ', self.xpath(self.ADDRESS_XPATH).text.strip())

    @fail_returns_none
    def get_address_precision(self):
        return 'Precise'

    @fail_returns_none
    def get_entity_type(self):
        return self.xpath(self.ENTITY_TYPE_XPATH).text.strip()

    @fail_returns_none
    def get_rating(self):
        return ''

    @fail_returns_none
    def get_primary_photo(self):
        return self.xpath(self.PRIMARY_PHOTO_XPATH).get_attribute('src')

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
    NAME_XPATH = 'html/body//h1'
    ADDRESS_XPATH = 'html/body//address/span[@rel="v:address"]//span[@class="format_address"]'
    ENTITY_TYPE_XPATH = 'html/body//address//span[@class="placeTypeText"]'

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
        return self.xpath('html/body//div[@rel="v:rating"]//img').get_attribute('content')

    def get_primary_photo(self):
        for img_xpath in ('html/body//img[@class="photo_image"]', 'html/body//img[@id="HERO_PHOTO"]'):
            img_node = self.xpath(img_xpath)
            if img_node is not None:
                return img_node.get_attribute('src')
        return None

class YelpScraper(ScrapedPage):
    NAME_XPATH = 'html/body//h1'
    ADDRESS_XPATH = 'html/body//address[@itemprop="address"]'
    PRIMARY_PHOTO_XPATH = 'html/body//div[contains(@class, "showcase-photos")]//div[@class="showcase-photo-box"]//img'

    @fail_returns_none
    def get_entity_type(self):
        categories_str = self.xpath('html/body//span[@class="category-str-list"]').text.strip()
        categories = [c.strip().lower() for c in categories_str.split(',')]
        if 'hotel' in categories or 'hotels' in categories:
            return 'Hotel'
        else:
            return 'Restaurant'

    @fail_returns_none
    def get_rating(self):
        return self.xpath('html/body//meta[@itemprop="ratingValue"]').get_attribute('content')

    @fail_returns_none
    def get_primary_photo(self):
        return super(YelpScraper, self).get_primary_photo().replace('ls.jpg', 'l.jpg')

class HotelsDotComScraper(ScrapedPage):
    NAME_XPATH = 'html/body//h1'
    ADDRESS_XPATH = 'html/body//div[@class="address-cntr"]/span[@class="adr"]'
    PRIMARY_PHOTO_XPATH = 'html/body//div[@id="hotel-photos"]//div[@class="slide active"]//img'

    def get_entity_type(self):
        return 'Hotel'

    @fail_returns_none
    def get_address(self):
        addr_parent = self.xpath('html/body//div[@class="address-cntr"]/span[@class="adr"]')
        street_addr = addr_parent.find_element_by_xpath('span[@class="street-address"]').text.strip()
        postal_addr = addr_parent.find_element_by_xpath('span[@class="postal-addr"]').text.strip()
        country = addr_parent.find_element_by_xpath('span[@class="country-name"]').text.strip().strip(',')
        return '%s %s %s' % (street_addr, postal_addr, country)

    @fail_returns_none
    def get_rating(self):
        # Looks like "4.5 / 5"
        rating_fraction_str = self.xpath('html/body//div[@class="score-summary"]/span[@class="rating"]').text.strip()
        return rating_fraction_str.split('/')[0].strip()

class AirbnbScraper(ScrapedPage):
    NAME_XPATH = 'html/body//div[@id="listing_name"]'
    ADDRESS_XPATH = 'html/body//div[@id="room"]//span[@id="display-address"]'
    PRIMARY_PHOTO_XPATH = 'html/body//div[@id="photos"]//ul[@class="slideshow-images"]//li[@class="active"]//img'

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
        return self.xpath('html/body//div[@id="room"]//meta[@itemprop="ratingValue"]').get_attribute('content')

def build_scraper(url):
    host = urlparse.urlparse(url).netloc.lower()
    browser = webdriver.PhantomJS()
    scraper_class = ScrapedPage
    if 'tripadvisor.com' in host:
        scraper_class = TripAdvisorScraper
    elif 'yelp.com' in host:
        scraper_class = YelpScraper
    elif 'hotels.com' in host:
        scraper_class = HotelsDotComScraper
    elif 'airbnb.com' in host:
        scraper_class = AirbnbScraper
    return scraper_class(url, browser)

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
        scraper.tear_down()
