import data
from scraping import html_parsing
from scraping.html_parsing import tostring
from scraping import scraped_page
from scraping.scraped_page import REQUIRES_SERVER_PAGE_SOURCE
from scraping.scraped_page import fail_returns_empty
from scraping.scraped_page import fail_returns_none
import values

class ZagatScraper(scraped_page.ScrapedPage):
    HANDLEABLE_URL_PATTERNS = scraped_page.urlpatterns(
        '^http(s)?://www\.zagat\.com/(r|n)/.+$',
        ('^http(s)?://www\.zagat\.com/l/.+/.+$',
            scraped_page.result_page_expander('.//div[contains(@class, "case")]//div[@class="text"]//a'),
            REQUIRES_SERVER_PAGE_SOURCE))

    NAME_XPATH = './/h1'
    PHONE_NUMBER_XPATH = './/div[@class="place-resume"]//span[@itemprop="postalCode"]/following-sibling::text()'
    WEBSITE_XPATH = './/div[@class="place-resume"]//a[@class="website"]/@href'

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
    def get_description(self):
        return self.root.xpath('.//p[@itemprop="reviewBody"]/text()')[0].strip()

    @fail_returns_none
    def get_primary_photo(self):
        return self.get_photos()[0]

    @fail_returns_empty
    def get_photos(self):
        urls = self.root.xpath('.//div[@class="place-wp"]//div[@class="image-box"]//a[contains(@class, "place-slideshow")]/@href')
        return [self.absolute_url(url) for url in urls]

    @fail_returns_none
    def get_opening_hours(self):
        hours_nodes = self.root.xpath('.//div[@class="place-resume"]//table[@class="hours-open"]//tr')
        texts = []
        for node in hours_nodes:
            day = tostring(node.xpath('.//td')[0])
            times = tostring(node.xpath('.//td')[1])
            texts.append('%s\t%s' % (day, times))
        source_text = '\n'.join(texts)
        return data.OpeningHours(source_text=source_text)
