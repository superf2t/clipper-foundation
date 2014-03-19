import json
import os

import constants
import serializable

class LatLng(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('lat', 'lng')

    def __init__(self, lat=None, lng=None):
        self.lat = lat
        self.lng = lng

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('name', 'entity_type', 'address',
        serializable.objf('latlng', LatLng), 'address_precision',
        'rating', 'description', 'primary_photo_url', 'source_url')

    def __init__(self, name=None, entity_type=None, address=None, latlng=None,
            address_precision=None, rating=None, description=None,
            primary_photo_url=None, source_url=None):
        self.name = name
        self.entity_type = entity_type
        self.address = address
        self.latlng = latlng
        self.address_precision = address_precision
        self.rating = rating
        self.description = description
        self.primary_photo_url = primary_photo_url
        self.source_url = source_url

class TripPlan(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('name', serializable.objlistf('entities', Entity))

    TYPES_IN_ORDER = ('Hotel', 'Restaurant', 'Attraction')

    def __init__(self, name=None, entities=()):
        self.name = name
        self.entities = entities or []

    def entities_for_type(self, entity_type):
        return [e for e in self.entities if e.entity_type == entity_type]

    def entities_json_str_for_type(self, entity_type):
        entities = self.entities_for_type(entity_type)
        if not entities:
            return ''
        return json.dumps([e.to_json_obj() for e in entities])

def trip_plan_filename(sessionid):
    return os.path.join(constants.PROJECTPATH, 'local_data', 'trip_plan_%s.json' % sessionid)

def load_trip_plan(sessionid):
    try:
        trip_plan_file = open(trip_plan_filename(sessionid))
    except IOError:
        return None
    json_data = json.load(trip_plan_file)
    trip_plan_file.close()
    return TripPlan.from_json_obj(json_data)

def save_trip_plan(trip_plan, sessionid):
    trip_plan_file = open(trip_plan_filename(sessionid), 'w')
    json_obj = trip_plan.to_json_obj()
    json.dump(json_obj, trip_plan_file, sort_keys=True, indent=4, separators=(',', ': '))
