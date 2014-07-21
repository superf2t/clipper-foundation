import re
import urlparse

import geocode
from html_parsing import tostring
from html_parsing import tostring_with_breaks

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

# Convenience constants for making url declarations more readable.
REQUIRES_SERVER_PAGE_SOURCE = True
REQUIRES_CLIENT_PAGE_SOURCE = True

def urlpatterns(*patterns):
    # Each element is either a single string value that should become a regex,
    # or a pair of regex-str and an expander function.
    output = []
    for pattern in patterns:
        if isinstance(pattern, basestring):
            output.append((re.compile(pattern), None, False, False))
        else:
            expander_fn = pattern[1]
            requires_server_page_source = pattern[2] if len(pattern) >= 3 else False
            requires_client_page_source = pattern[3] if len(pattern) >= 4 else False
            output.append((re.compile(pattern[0]), expander_fn, requires_server_page_source, requires_client_page_source))
    return tuple(output)

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
    PHONE_NUMBER_XPATH = None
    WEBSITE_XPATH = None
    REVIEW_COUNT_XPATH = None 
    PRIMARY_PHOTO_XPATH = None

    RATING_MAX = None

    LOCATION_RESOLUTION_STRATEGY = LocationResolutionStrategy.from_options(
        LocationResolutionStrategy.ADDRESS)

    HANDLEABLE_URL_PATTERNS = ()

    @classmethod
    def handleable_urls(cls, incoming_url, page_source_tree, allow_expansion=True):
        for regex, expander_fn, ignored, ignored in cls.HANDLEABLE_URL_PATTERNS:
            if regex.match(incoming_url):
                if expander_fn:
                    if allow_expansion:
                        return expander_fn(incoming_url, page_source_tree)
                    else:
                        return ()
                else:
                    return (incoming_url,)
        return ()

    @classmethod
    def is_url_handleable(cls, incoming_url, allow_expansion=True):
        for regex, expander_fn, ignored, ignored in cls.HANDLEABLE_URL_PATTERNS:
            if regex.match(incoming_url):
                if allow_expansion or not expander_fn:
                    return True
        return False

    @classmethod
    def url_requires_client_page_source(cls, url):
        for regex, ignored, ignored, requires_client_page_source in cls.HANDLEABLE_URL_PATTERNS:
            if requires_client_page_source and regex.match(url):
                return True
        return False

    @classmethod
    def url_requires_server_page_source(cls, url):
        for regex, ignored, requires_server_page_source, ignored in cls.HANDLEABLE_URL_PATTERNS:
            if requires_server_page_source and regex.match(url):
                return True
        return False

    def __init__(self, url, tree, for_guide=False):
        self.url = url
        self.tree = tree
        self.root = tree.getroot()
        self.for_guide = for_guide
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

    def get_category(self):
        return None

    def get_sub_category(self):
        return None

    def get_description(self):
        return None

    def get_rating(self):
        return None

    def get_rating_max(self):
        return self.RATING_MAX

    @fail_returns_none
    def get_review_count(self):
        return int(self.root.xpath(self.REVIEW_COUNT_XPATH)[0]) if self.REVIEW_COUNT_XPATH else None

    def get_starred(self):
        return None

    @fail_returns_none
    def get_primary_photo(self):
        return self.root.find(self.PRIMARY_PHOTO_XPATH).get('src')

    def get_photos(self):
        return ()

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

    def get_phone_number(self):
        if self.PHONE_NUMBER_XPATH:
            phone_node = self.root.xpath(self.PHONE_NUMBER_XPATH)
            if phone_node:
                return phone_node[0].strip()
        return None

    def get_opening_hours(self):
        return None

    @fail_returns_none
    def get_website(self):
        return self.root.xpath(self.WEBSITE_XPATH)[0] if self.WEBSITE_XPATH else None

    def get_source_url(self):
        return self.url

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
Description: %s
Phone number: %s
Website: %s
Hours: %s
Rating: %s/%s
Review count: %s
Primary photo url: %s
Photo urls: %s''' % (
    self.get_entity_name(),
    self.get_category(),
    self.get_sub_category(),
    self.get_address(),
    self.get_description(),
    self.get_phone_number(),
    self.get_website(),
    self.get_opening_hours().source_text if self.get_opening_hours() else None,
    self.get_rating(),
    self.get_rating_max(),
    self.get_review_count(),
    self.get_primary_photo(),
    self.get_photos())


def expand_result_page(xpath, url, page_source_tree):
    if not page_source_tree:
        return ()
    root = page_source_tree.getroot()
    links = root.xpath(xpath)
    return [urlparse.urljoin(url, link.get('href')) for link in links if link.get('href')]

def result_page_expander(xpath):
    return lambda url, page_source_tree: expand_result_page(xpath, url, page_source_tree)


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
