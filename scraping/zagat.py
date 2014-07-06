from scraping import html_parsing
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class ZagatScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.zagat\.com/(r|n)/.+$')

    NAME_XPATH = './/h1'

    @fail_returns_none
    def get_address(self):
        addr_root = self.root.find('.//p[@itemprop="address"]')
        return html_parsing.join_element_text_using_xpaths(addr_root, (
            './/*[@itemprop="streetAddress"]', './/*[@itemprop="addressLocality"]',
            './/*[@itemprop="addressRegion"]', './/*[@itemprop="postalCode"]'))

    @fail_returns_none
    def get_category(self):
        return values.Category.FOOD_AND_DRINK

    @fail_returns_none
    def get_sub_category(self):
        category_node = self.root.xpath('.//div[@class="place-post"]//span[@class="date"]')[0]
        category_text = tostring(category_node).split('|')[0].strip().lower()
        if 'bar' in category_text:
            return values.SubCategory.BAR
        elif 'club' in category_text:
            return values.SubCategory.NIGHTCLUB
        return values.SubCategory.RESTAURANT

    @fail_returns_none
    def get_primary_photo(self):
        return self.get_photos()[0]

    @fail_returns_empty
    def get_photos(self):
        urls = self.root.xpath('.//div[@class="place-wp"]//div[@class="image-box"]//a[contains(@class, "place-slideshow")]/@href')
        return [self.absolute_url(url) for url in urls]
