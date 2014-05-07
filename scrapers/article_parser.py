import data
import geocode
import scraper

class ArticleParser(object):
    URL_REGEX = None

    TITLE_XPATH = ''

    def __init__(self, url, tree):
        self.url = url
        self.root = tree.getroot()
        self._location = None
        self._queried_for_location = False

    def get_title(self):
        return scraper.tostring(self.root.find(self.TITLE_XPATH))

    def get_description(self):
        return None

    def get_cover_image_url(self):
        return self.root.xpath(self.COVER_IMAGE_URL_XPATH)[0]

    def get_source_url(self):
        return self.url

    def get_raw_entities(self):
        return ()

    def get_entities(self):
        entities = self.get_raw_entities()
        for entity in entities:
            entity.entity_id = data.generate_entity_id()
        return entities

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
        return data.TripPlan(name=self.get_title(), description=self.get_description(),
            cover_image_url=self.get_cover_image_url(), source_url=self.get_source_url(),
            location_name=self.get_location_name(), location_latlng=self.get_location_latlng(),
            location_bounds=self.get_location_bounds(),
            entities=self.get_entities())        

    @classmethod
    def can_parse(cls, url):
        return cls.URL_REGEX and cls.URL_REGEX.match(url)
