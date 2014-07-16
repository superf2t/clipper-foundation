from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import fail_returns_none
import utils
import values

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

    @fail_returns_none
    def get_website(self):
        infocard_cells = self.root.findall('.//table[@class="infobox vcard"]//tr')
        for tr in infocard_cells:
            th = tr.find('.//th')
            if th is not None and th.text == 'Website':
                return tr.xpath('.//td//a/@href')[0]
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
