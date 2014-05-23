import datetime
import json
import os

from dateutil import parser as date_parser
from dateutil import tz

import constants
import enums
import serializable
import struct
import values
import uuid

class LatLng(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('lat', 'lng')

    def __init__(self, lat=None, lng=None):
        self.lat = lat
        self.lng = lng

class LatLngBounds(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(
        serializable.objf('southwest', LatLng),
        serializable.objf('northeast', LatLng))

    def __init__(self, southwest=None, northeast=None):
        self.southwest = southwest
        self.northeast = northeast


SUB_CATEGORY_NAME_TO_ICON_URL = {
    values.SubCategory.HOTEL.name: 'hotel.png',
    values.SubCategory.PRIVATE_RENTAL.name: 'private-rental.png',
    values.SubCategory.BED_AND_BREAKFAST.name: 'bed-and-breakfast.png',
    values.SubCategory.HOSTEL.name: 'hostel.png',
    values.SubCategory.COUCHSURFING.name: 'couch-surfing.png',
    values.SubCategory.FRIENDS_AND_FAMILY.name: 'friends-and-family.png',

    values.SubCategory.RESTAURANT.name: 'restaurant.png',
    values.SubCategory.BAR.name: 'bar.png',
    values.SubCategory.NIGHTCLUB.name: 'nightclub.png',
    values.SubCategory.FOOD_TRUCK.name: 'food-truck.png',
    values.SubCategory.STREET_FOOD.name: 'street-food.png',
    values.SubCategory.COFFEE_SHOP.name: 'coffee.png',
    values.SubCategory.BAKERY.name: 'bakery.png',
    values.SubCategory.DESSERT.name: 'dessert.png',

    values.SubCategory.LANDMARK.name: 'landmark.png',
    values.SubCategory.MUSEUM.name: 'museum.png',

    values.SubCategory.TOUR.name: 'tour.png',
    values.SubCategory.OUTDOOR.name: 'outdoor.png',

    values.SubCategory.MUSIC.name: 'music.png',
    values.SubCategory.THEATER.name: 'theater.png',
    values.SubCategory.SPORTS.name: 'sports.png',
    values.SubCategory.DANCE.name: 'dance.png',
    values.SubCategory.COMEDY.name: 'comedy.png',
}

CATEGORY_NAME_TO_ICON_URL = {
    values.Category.LODGING.name: 'lodging.png',
    values.Category.FOOD_AND_DRINK.name: 'food-and-drink.png',
    values.Category.ATTRACTIONS.name: 'sight.png',
    values.Category.ACTIVITIES.name: 'activity.png',
    values.Category.SHOPPING.name: 'shopping.png',
    values.Category.ENTERTAINMENT.name: 'entertainment.png',
}

DEFAULT_ICON_URL = 'default.png'

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('entity_id', 'name',
        serializable.objf('category', values.Category),
        serializable.objf('sub_category', values.SubCategory),
        'address',
        serializable.objf('latlng', LatLng), 'address_precision',
        'rating', 'description', 'starred',
        'primary_photo_url', serializable.listf('photo_urls'),
        'source_url', 'icon_url', 'google_reference', 'day', 'day_position')

    def __init__(self, entity_id=None, name=None,
            category=None, sub_category=None,
            address=None, latlng=None, address_precision=None,
            rating=None, description=None, starred=None,
            primary_photo_url=None, photo_urls=(), source_url=None, icon_url=None,
            google_reference=None, day=None, day_position=None):
        self.entity_id = entity_id
        self.name = name
        self.category = category
        self.sub_category = sub_category
        self.address = address
        self.latlng = latlng
        self.address_precision = address_precision
        self.rating = rating
        self.description = description
        self.starred = starred
        self.primary_photo_url = primary_photo_url
        self.photo_urls = photo_urls or []
        self.source_url = source_url
        self.google_reference = google_reference
        self.day = day
        self.day_position = day_position

        self.initialize()

    def initialize(self):
        self.set_icon_url()

    def set_icon_url(self):
        icon_url = None
        if self.sub_category:
            icon_url = SUB_CATEGORY_NAME_TO_ICON_URL.get(self.sub_category.name)
        if not icon_url and self.category:
            icon_url = CATEGORY_NAME_TO_ICON_URL.get(self.category.name)
        if not icon_url:
            icon_url = DEFAULT_ICON_URL
        if icon_url and self.address_precision == 'Imprecise':
            icon_url = icon_url.replace('.', '-imprecise.')
        self.icon_url = icon_url

    @staticmethod
    def chronological_cmp(e1, e2):
        if e1.day == e2.day:
            return cmp(d1.day_position, d2.day_position)
        elif e1.day and e2.day:
            return cmp(e1.day, e2.day)
        return -cmp(e1.day, e2.day)

class Note(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('note_id', 'text', 'day', 'day_position', 'status')

    Status = enums.enum('ACTIVE', 'DELETED')

    def __init__(self, note_id=None, text=None, day=None, day_position=None, status=None):
        self.note_id = note_id
        self.text = text
        self.day = day
        self.day_position = day_position
        self.status = status

class TripPlan(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id', 'name',
        'location_name', serializable.objf('location_latlng', LatLng),
        serializable.objf('location_bounds', LatLngBounds),
        'description', 'cover_image_url', 'source_url',
        serializable.objlistf('entities', Entity),
        serializable.objlistf('notes', Note),
        'creator', serializable.listf('editors'),
        'last_modified', 'status')

    Status = enums.enum('ACTIVE', 'DELETED')

    def __init__(self, trip_plan_id=None, name=None,
            location_name=None, location_latlng=None, location_bounds=None,
            description=None, cover_image_url=None, source_url=None,
            entities=(), notes=(),
            creator=None, editors=(), last_modified=None, status=Status.ACTIVE.name):
        self.trip_plan_id = trip_plan_id
        self.name = name
        self.location_name = location_name
        self.location_latlng = location_latlng
        self.location_bounds = location_bounds
        self.description = description
        self.cover_image_url = cover_image_url
        self.source_url = source_url
        self.entities = entities or []
        self.notes = notes or []
        self.last_modified = last_modified
        self.status = status

        # TODO: Make these private fields
        self.creator = creator
        self.editors = editors or []

    def entity_by_source_url(self, source_url):
        for entity in self.entities:
            if entity.source_url == source_url:
                return entity
        return None

    def contains_url(self, url):
        for entity in self.entities:
            if entity.source_url == url:
                return True
        return False

    def editable_by(self, session_info):
        return str(self.creator) in (session_info.email, str(session_info.sessionid)) or session_info.is_admin()

    def trip_plan_url(self):
        return '%s/trip_plan/%s' % (constants.BASE_URL, self.trip_plan_id)

    def entities_in_chronological_order(self):
        return sorted(self.entities, cmp=Entity.chronological_cmp)

    def last_modified_datetime(self):
        if not self.last_modified:
            return None
        return date_parser.parse(self.last_modified)

    def set_last_modified_datetime(self, d):
        self.last_modified = d.isoformat()

    def strip_readonly_fields(self):
        self.entities = ()
        self.notes = ()
        self.creator = None
        self.editors = ()
        self.last_modified = None
        return self

    def strip_child_objects(self):
        self.entities = ()
        return self

    def compare(self, other):
        if self.last_modified and other.last_modified:
            return cmp(other.last_modified_datetime(), self.last_modified_datetime())
        elif self.last_modified:
            return -1
        elif other.last_modified:
            return 1
        else:
            return cmp(other.name, self.name)


class SessionInfo(object):
    def __init__(self, email=None, sessionid=None, set_on_response=False):
        self.email = email
        self.sessionid = sessionid
        self.set_on_response = set_on_response
        self.logged_in = False

    @property
    def user_identifier(self):
        return self.email or self.sessionid

    def is_admin(self):
        return self.email in ('admin@unicyclelabs.com',)

def generate_sessionid():
    sessionid = uuid.uuid4().bytes[:8]
    return struct.unpack('Q', sessionid)[0]


class InitialPageState(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('sort', 'mid_panel_expanded', 'needs_tutorial')

    def __init__(self, sort=None, mid_panel_expanded=None, needs_tutorial=None):
        self.sort = sort
        self.mid_panel_expanded = mid_panel_expanded
        self.needs_tutorial = needs_tutorial

class AccountInfo(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('email')

    def __init__(self, email=None):
        self.email = email


def generate_entity_id():
    return generate_id()

def generate_note_id():
    return generate_id()

def generate_trip_plan_id():
    return generate_id()

def generate_id():
    randid = uuid.uuid4().bytes[:8]
    # Use mod 2**53 so the number can be represented natively in Javascript.
    return struct.unpack('Q', randid)[0] % 2**53    

def trip_plan_filename_from_session_info(session_info):
    return trip_plan_filename(session_info.user_identifier, session_info.active_trip_plan_id)

def trip_plan_filename(user_identifier, trip_plan_id):
    return os.path.join(constants.PROJECTPATH, 'local_data', 'trip_plan_%s_%s.json' % (user_identifier, trip_plan_id))

def load_trip_plan(session_info):
    return load_trip_plan_from_filename(trip_plan_filename_from_session_info(session_info))

def load_trip_plan_from_filename(fname, include_deleted=False):
    try:
        trip_plan_file = open(fname)
    except IOError:
        return None
    json_data = json.load(trip_plan_file)
    trip_plan_file.close()
    trip_plan = TripPlan.from_json_obj(json_data)
    if not include_deleted and trip_plan.status == TripPlan.Status.DELETED.name:
        return None
    return trip_plan

def load_trip_plan_by_id(trip_plan_id):
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    suffix = '_%s.json' % trip_plan_id
    for fname in os.listdir(data_dir):
        if fname.endswith(suffix):
            full_fname = os.path.join(constants.PROJECTPATH, 'local_data', fname)
            return load_trip_plan_from_filename(full_fname)
    return None

def load_trip_plans_by_ids(trip_plan_ids):
    return [load_trip_plan_by_id(id) for id in trip_plan_ids]

def load_all_trip_plans(session_info):
    trip_plans = []    
    fname_prefix = 'trip_plan_%s_' % session_info.user_identifier
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    for fname in os.listdir(data_dir):
        if fname.startswith(fname_prefix):
            full_fname = os.path.join(constants.PROJECTPATH, 'local_data', fname)
            trip_plan = load_trip_plan_from_filename(full_fname)
            if trip_plan:
                trip_plans.append(trip_plan)
    return trip_plans

def save_trip_plan(trip_plan, update_timestamp=True):
    if update_timestamp:
        trip_plan.set_last_modified_datetime(datetime.datetime.now(tz.tzutc()))
    json_obj = trip_plan.to_json_obj()
    json_str = json.dumps(json_obj, sort_keys=True, indent=4, separators=(',', ': '))
    trip_plan_file = open(trip_plan_filename(trip_plan.creator, trip_plan.trip_plan_id), 'w')
    trip_plan_file.write(json_str)
    trip_plan_file.close()

def change_creator(trip_plan, new_creator):
    old_fname = trip_plan_filename(trip_plan.creator, trip_plan.trip_plan_id)
    trip_plan.creator = new_creator
    save_trip_plan(trip_plan)
    os.remove(old_fname)
    return trip_plan
