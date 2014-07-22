import urlparse

from lxml import etree

import clip_logic
import data
import geocode
from scraping import html_parsing

class ArticleParser(object):
    URL_REGEX = None

    TITLE_XPATH = ''
    COVER_IMAGE_URL_XPATH = None

    ALLOW_ENTITY_SCRAPING = False

    def __init__(self, url, tree):
        self.url = url
        self.root = tree.getroot()
        self._location = None
        self._queried_for_location = False

    def get_title(self):
        return html_parsing.tostring(self.root.xpath(self.TITLE_XPATH)[0])

    def get_description(self):
        return None

    def get_cover_image_url(self):
        if self.COVER_IMAGE_URL_XPATH:
            img_elem = self.root.xpath(self.COVER_IMAGE_URL_XPATH)
            if img_elem:
                return img_elem[0]
        return None

    def get_source_url(self):
        return type(self).canonicalize(self.url)

    # Return a datetime object in UTC.
    def get_content_date_datetime(self):
        return None

    def get_raw_entities(self):
        if self.ALLOW_ENTITY_SCRAPING:
            return clip_logic.scrape_entities_from_url(self.url,
                page_source=etree.tostring(self.root), for_guide=True)
        return ()

    def get_entities(self):
        entities = self.get_raw_entities()
        for entity in entities:
            entity.entity_id = data.generate_entity_id()

        entity_overrides_dict = self.get_entity_overrides()
        if entity_overrides_dict:
            entities_by_source_url = dict((e.source_url, e) for e in entities)
            for source_url, override in entity_overrides_dict.iteritems():
                entity = entities_by_source_url.get(source_url)
                if entity and override:
                    entity.update(override)

        return entities

    def get_entity_overrides(self):
        return {}

    def get_location_name(self):
        return None

    def get_location_latlng(self):
        location = self._lookup_location()
        if location:
            return data.LatLng.from_json_obj(location.latlng_json())
        return None

    def get_location_bounds(self):
        location = self._lookup_location()
        if location:
            viewport = location.viewport_json()
            if viewport:
                return data.LatLngBounds.from_json_obj(viewport)
        return None

    def _lookup_location(self):
        if not self._location and not self._queried_for_location:
            self._location = geocode.lookup_place(self.get_location_name())
            self._queried_for_location = True
        return self._location

    def make_raw_trip_plan(self):
        self._lookup_location()
        return data.TripPlan(name=self.get_title(), description=self.get_description(),
            cover_image_url=self.get_cover_image_url(), source_url=self.get_source_url(),
            location_name=self._location.get_name() if self._location else self.get_location_name(),
            location_latlng=self.get_location_latlng(),
            location_bounds=self.get_location_bounds(),
            entities=self.get_entities(),
            content_date_datetime=self.get_content_date_datetime(),
            trip_plan_type=data.TripPlanType.GUIDE.name)        

    def absolute_url(self, relative_url):
        return urlparse.urljoin(self.url, relative_url)

    @classmethod
    def can_parse(cls, url):
        return cls.URL_REGEX and cls.URL_REGEX.match(url)

    @classmethod
    def canonicalize(cls, url):
        if cls.URL_REGEX:
            return cls.URL_REGEX.match(url).group(1)
        return url
