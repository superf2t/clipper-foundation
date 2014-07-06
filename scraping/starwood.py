import re
import urlparse

from scraping import html_parsing
from scraping import scraped_page
from scraping.scraped_page import fail_returns_none
import values

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
