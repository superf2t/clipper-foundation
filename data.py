import json
import os

import constants
import serializable
import values

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

SUB_CATEGORY_NAME_TO_ICON_URL = {
    values.SubCategory.HOTEL.name: 'lodging_0star.png',
    values.SubCategory.PRIVATE_RENTAL.name: 'lodging_0star.png',
    values.SubCategory.RESTAURANT.name: 'restaurant.png',
    values.SubCategory.BAR.name: 'bar_coktail.png',
}

CATEGORY_NAME_TO_ICON_URL = {
    values.Category.LODGING.name: 'lodging_0star.png',
    values.Category.FOOD_AND_DRINK.name: 'restaurant.png',
    values.Category.ATTRACTIONS.name: 'sight-2.png',
}

# For backwards compatibility
ENTITY_TYPE_TO_CATEGORY = {
    'Hotel': values.Category.LODGING,
    'Restaurant': values.Category.FOOD_AND_DRINK,
    'Attraction': values.Category.ATTRACTIONS,
}

# For backwards compatibility
ENTITY_TYPE_TO_SUB_CATEGORY = {
    'Hotel': values.SubCategory.HOTEL,
    'Restaurant': values.SubCategory.RESTAURANT,
    'Attraction': None  # TODO
}

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('name', 'entity_type', 
        serializable.objf('category', values.Category),
        serializable.objf('sub_category', values.SubCategory),
        'address',
        serializable.objf('latlng', LatLng), 'address_precision',
        'rating', 'description', 'primary_photo_url', serializable.listf('photo_urls'),
        'source_url', 'icon_url')

    def __init__(self, name=None, entity_type=None,
            category=None, sub_category=None,
            address=None, latlng=None,
            address_precision=None, rating=None, description=None,
            primary_photo_url=None, photo_urls=(), source_url=None, icon_url=None):
        self.name = name
        self.entity_type = entity_type  # Deprecated
        self.category = category
        self.sub_category = sub_category
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
        if self.entity_type and not self.category:
            self.category = ENTITY_TYPE_TO_CATEGORY.get(self.entity_type)
            self.sub_category = ENTITY_TYPE_TO_SUB_CATEGORY.get(self.entity_type)
        self.set_icon_url()

    def set_icon_url(self):
        icon_url = ''
        if self.sub_category:
            icon_url = SUB_CATEGORY_NAME_TO_ICON_URL.get(self.sub_category.name)
        elif self.category:
            icon_url = CATEGORY_NAME_TO_ICON_URL.get(self.category.name)
        if self.address_precision == 'Imprecise':
            icon_url = icon_url.replace('.', '_imprecise.')
        self.icon_url = icon_url

class ClippedPage(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('source_url', 'title')

    def __init__(self, source_url=None, title=None):
        self.source_url = source_url
        self.title = title

class TripPlan(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id', 'name',
        serializable.objlistf('entities', Entity),
        serializable.objlistf('clipped_pages', ClippedPage),
        'creator', serializable.listf('editors'))

    TYPES_IN_ORDER = ('Hotel', 'Restaurant', 'Attraction')

    def __init__(self, trip_plan_id=None, name=None, entities=(), clipped_pages=(), creator=None, editors=()):
        self.trip_plan_id = trip_plan_id
        self.name = name
        self.entities = entities or []
        self.clipped_pages = clipped_pages or []

        # TODO: Make these private fields
        self.creator = creator
        self.editors = editors or []

    def entities_for_type(self, entity_type):
        return [e for e in self.entities if e.entity_type == entity_type]

    def entities_json_str_for_type(self, entity_type):
        entities = self.entities_for_type(entity_type)
        if not entities:
            return ''
        return json.dumps([e.to_json_obj() for e in entities])

    def remove_entity_by_source_url(self, source_url):
        for i in range(len(self.entities)):
            if self.entities[i].source_url == source_url:
                return self.entities.pop(i)
        return None

    def as_settings(self):
        return TripPlanSettings(str(self.trip_plan_id), name=self.name)        

    def settings_json(self):
        return self.as_settings().to_json_str()

    def contains_url(self, url):
        for entity in self.entities:
            if entity.source_url == url:
                return True
        for clipped_page in self.clipped_pages:
            if clipped_page.source_url == url:
                return True
        return False

    def editable_by(self, session_info):
        return str(self.creator) in (session_info.email, str(session_info.sessionid))

    def trip_plan_url(self):
        return '%s/trip_plan/%s' % (constants.BASE_URL, self.trip_plan_id)

class TripPlanSettings(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id_str', 'name')

    def __init__(self, trip_plan_id_str=None, name=None):
        self.trip_plan_id_str = trip_plan_id_str
        self.name = name


class EditEntityRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id_str', serializable.objf('entity', Entity))

    def __init__(self, trip_plan_id_str=None, entity=None):
        self.trip_plan_id_str = trip_plan_id_str
        self.entity = entity

    @property
    def trip_plan_id(self):
        return int(self.trip_plan_id_str)

class EditTripPlanRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id_str', 'name')

    def __init__(self, trip_plan_id=None, trip_plan_id_str=None, name=None):
        self.trip_plan_id_str = trip_plan_id_str
        self.name = name

    @property
    def trip_plan_id(self):
        return int(self.trip_plan_id_str)

class DeleteEntityRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id_str', 'source_url')

    def __init__(self, trip_plan_id_str=None, source_url=None):
        self.trip_plan_id_str = trip_plan_id_str
        self.source_url = source_url

    @property
    def trip_plan_id(self):
        return int(self.trip_plan_id_str)


class SessionInfo(object):
    def __init__(self, email=None, active_trip_plan_id=None, sessionid=None, set_on_response=False):
        self.email = email
        self.active_trip_plan_id = active_trip_plan_id
        self.sessionid = sessionid
        self.set_on_response = set_on_response
        self.clear_active_trip_plan_id = False

    @property
    def user_identifier(self):
        return self.email or self.sessionid


class AccountInfo(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('email', 'active_trip_plan_id', 'active_trip_plan_name')

    def __init__(self, email=None, active_trip_plan_id=None, active_trip_plan_name=None):
        self.email = email
        self.active_trip_plan_id = active_trip_plan_id
        self.active_trip_plan_name = active_trip_plan_name


def trip_plan_filename_from_session_info(session_info):
    return trip_plan_filename(session_info.user_identifier, session_info.active_trip_plan_id)

def trip_plan_filename(user_identifier, trip_plan_id):
    return os.path.join(constants.PROJECTPATH, 'local_data', 'trip_plan_%s_%s.json' % (user_identifier, trip_plan_id))

def load_trip_plan(session_info):
    return load_trip_plan_from_filename(trip_plan_filename_from_session_info(session_info))

def load_trip_plan_from_filename(fname):
    try:
        trip_plan_file = open(fname)
    except IOError:
        return None
    json_data = json.load(trip_plan_file)
    trip_plan_file.close()
    return TripPlan.from_json_obj(json_data)

def load_trip_plan_by_id(trip_plan_id):
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    suffix = '_%s.json' % trip_plan_id
    for fname in os.listdir(data_dir):
        if fname.endswith(suffix):
            full_fname = os.path.join(constants.PROJECTPATH, 'local_data', fname)
            return load_trip_plan_from_filename(full_fname)
    return None

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

def save_trip_plan(trip_plan):
    trip_plan_file = open(trip_plan_filename(trip_plan.creator, trip_plan.trip_plan_id), 'w')
    json_obj = trip_plan.to_json_obj()
    json.dump(json_obj, trip_plan_file, sort_keys=True, indent=4, separators=(',', ': '))

def change_creator(trip_plan, new_creator):
    old_fname = trip_plan_filename(trip_plan.creator, trip_plan.trip_plan_id)
    trip_plan.creator = new_creator
    save_trip_plan(trip_plan)
    os.remove(old_fname)
    return trip_plan
