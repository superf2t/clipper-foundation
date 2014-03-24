import json
import os

import constants
import serializable

class LatLng(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('lat', 'lng')

    def __init__(self, lat=None, lng=None):
        self.lat = lat
        self.lng = lng

ENTITY_TYPE_TO_ICON_URL = {
    'Attraction': 'sight-2.png',
    'Restaurant': 'restaurant.png',
    'Hotel': 'lodging_0star.png',
    'Nightlife': 'bar_coktail.png',
}

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('name', 'entity_type', 'address',
        serializable.objf('latlng', LatLng), 'address_precision',
        'rating', 'description', 'primary_photo_url', serializable.listf('photo_urls'),
        'source_url', 'icon_url')

    def __init__(self, name=None, entity_type=None, address=None, latlng=None,
            address_precision=None, rating=None, description=None,
            primary_photo_url=None, photo_urls=(), source_url=None, icon_url=None):
        self.name = name
        self.entity_type = entity_type
        self.address = address
        self.latlng = latlng
        self.address_precision = address_precision
        self.rating = rating
        self.description = description
        self.primary_photo_url = primary_photo_url
        self.photo_urls = photo_urls or []
        self.source_url = source_url

        self.initialize()

    def initialize(self):
        icon_url = ENTITY_TYPE_TO_ICON_URL.get(self.entity_type)
        if self.address_precision == 'Imprecise':
            icon_url = icon_url.replace('.', '_imprecise.')
        self.icon_url = icon_url

class ClippedPage(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('source_url', 'title')

    def __init__(self, source_url=None, title=None):
        self.source_url = source_url
        self.title = title

class TripPlan(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('name', serializable.objlistf('entities', Entity),
        serializable.objlistf('clipped_pages', ClippedPage))

    TYPES_IN_ORDER = ('Hotel', 'Restaurant', 'Attraction')

    def __init__(self, name=None, entities=(), clipped_pages=()):
        self.name = name
        self.entities = entities or []
        self.clipped_pages = clipped_pages or []

    def entities_for_type(self, entity_type):
        return [e for e in self.entities if e.entity_type == entity_type]

    def entities_json_str_for_type(self, entity_type):
        entities = self.entities_for_type(entity_type)
        if not entities:
            return ''
        return json.dumps([e.to_json_obj() for e in entities])

    def contains_url(self, url):
        for entity in self.entities:
            if entity.source_url == url:
                return True
        for clipped_page in self.clipped_pages:
            if clipped_page.source_url == url:
                return True
        return False

class SessionInfo(object):
    def __init__(self, email=None, active_map_id=None, sessionid=None, set_on_response=False):
        self.email = email
        self.active_map_id = active_map_id
        self.sessionid = sessionid
        self.set_on_response = set_on_response


def trip_plan_filename(session_info):
    if session_info.email:
        user_namespace_identifier = session_info.email
    else:
        user_namespace_identifier = session_info.sessionid
    return os.path.join(constants.PROJECTPATH, 'local_data', 'trip_plan_%s_%s.json' % (user_namespace_identifier, session_info.active_map_id))

def load_trip_plan(session_info):
    try:
        trip_plan_file = open(trip_plan_filename(session_info))
    except IOError:
        return None
    json_data = json.load(trip_plan_file)
    trip_plan_file.close()
    return TripPlan.from_json_obj(json_data)

def save_trip_plan(trip_plan, session_info):
    trip_plan_file = open(trip_plan_filename(session_info), 'w')
    json_obj = trip_plan.to_json_obj()
    json.dump(json_obj, trip_plan_file, sort_keys=True, indent=4, separators=(',', ': '))
