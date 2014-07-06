import re

from scrapers.html_parsing import tostring
from scrapers import scraped_page
from scrapers.scraped_page import REQUIRES_CLIENT_PAGE_SOURCE
import values

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
