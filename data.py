import datetime
import json
import os

from dateutil import parser as date_parser
from dateutil import tz

import constants
import crypto
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

class DisplayUser(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('public_id', 'display_name', 'public_visitor_id')

    def __init__(self, public_id=None, display_name=None, public_visitor_id=None):
        self.public_id = public_id
        self.display_name = display_name
        self.public_visitor_id = public_visitor_id

class Comment(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(
        'comment_id', 'entity_id', 'text', 'author',
        serializable.objf('user', DisplayUser), 'last_modified')

    def __init__(self, comment_id=None, entity_id=None, text=None,
            author=None, user=None, last_modified=None):
        self.comment_id = comment_id
        self.entity_id = entity_id
        self.text = text
        self.author = author  # Deprecated in favor of user
        self.user = user
        self.last_modified = last_modified

    def last_modified_datetime(self):
        if not self.last_modified:
            return None
        return date_parser.parse(self.last_modified)

    def set_last_modified_datetime(self, d):
        self.last_modified = d.isoformat()

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('entity_id', 'name',
        serializable.objf('category', values.Category),
        serializable.objf('sub_category', values.SubCategory),
        'address',
        serializable.objf('latlng', LatLng), 'address_precision',
        'rating', 'description', 'starred',
        'primary_photo_url', serializable.listf('photo_urls'),
        'source_url', 'google_reference', 'day', 'day_position',
        serializable.objlistf('comments', Comment))

    def __init__(self, entity_id=None, name=None,
            category=None, sub_category=None,
            address=None, latlng=None, address_precision=None,
            rating=None, description=None, starred=None,
            primary_photo_url=None, photo_urls=(), source_url=None,
            google_reference=None, day=None, day_position=None,
            comments=None):
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
        self.comments = comments or []

    def comment_by_id(self, comment_id):
        for comment in self.comments:
            if comment.comment_id == comment_id:
                return comment
        return None

    def append_comment(self, comment):
        if self.comments is None:
            self.comments = []
        self.comments.append(comment)

    def delete_comment_by_id(self, comment_id):
        for i, comment in enumerate(self.comments):
            if comment.comment_id == comment_id:
                return self.comments.pop(i)
        return None

    @staticmethod
    def chronological_cmp(e1, e2):
        if e1.day == e2.day:
            return cmp(e1.day_position, e2.day_position)
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
        'creator', serializable.objf('user', DisplayUser),
        serializable.objlistf('editors', DisplayUser),
        'last_modified', 'status')

    Status = enums.enum('ACTIVE', 'DELETED')

    def __init__(self, trip_plan_id=None, name=None,
            location_name=None, location_latlng=None, location_bounds=None,
            description=None, cover_image_url=None, source_url=None,
            entities=(), notes=(),
            creator=None, user=None, editors=(), last_modified=None, status=Status.ACTIVE.name):
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
        self.user = user
        self.creator = creator  # Deprecated in favor of user
        self.editors = editors or []
        # self.invited_editors = invited_editors or []

    def entity_by_source_url(self, source_url):
        for entity in self.entities:
            if entity.source_url == source_url:
                return entity
        return None

    def entity_by_id(self, entity_id):
        for entity in self.entities:
            if entity.entity_id == entity_id:
                return entity
        return None

    def contains_url(self, url):
        for entity in self.entities:
            if entity.source_url == url:
                return True
        return False

    def editable_by(self, session_info):
        if session_info.is_admin():
            return True
        if session_info.logged_in():
            if self.user and session_info.db_user.public_id == self.user.public_id:
                return True
            for editor in self.editors:
                if session_info.db_user.public_id == editor.public_id:
                    return True
        else:
            if self.user:
                return session_info.public_visitor_id and session_info.public_visitor_id == self.user.public_visitor_id
            else:
                return session_info.visitor_id and session_info.visitor_id == self.creator

    def creator_identifier(self):
        if self.user and self.user.public_id:
            return crypto.decrypt_id(self.user.public_id)
        elif self.user and self.user.public_visitor_id:
            return crypto.decrypt_id(self.user.public_visitor_id)
        else:
            return self.creator

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
    def __init__(self, email=None, old_email=None, visitor_id=None, db_user=None):
        self.email = email
        self.old_email = old_email
        self.visitor_id = visitor_id
        self.db_user = db_user

    @property
    def public_visitor_id(self):
        if not hasattr(self, '_cached_public_visitor_id'):
            self._cached_public_visitor_id = crypto.encrypt_id(self.visitor_id)
        return self._cached_public_visitor_id

    def is_admin(self):
        return self.email in ('admin@unicyclelabs.com',)

    def logged_in(self):
        return bool(self.db_user)

class FlashedMessage(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('message', 'category')

    def __init__(self, message=None, category=None):
        self.message = message
        self.category = category

class InitialPageState(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('sort', 'needs_tutorial')

    def __init__(self, sort=None, needs_tutorial=None):
        self.sort = sort
        self.needs_tutorial = needs_tutorial

class AccountInfo(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('email', 'display_name', 'logged_in')

    def __init__(self, email=None, display_name=None):
        self.email = email
        self.display_name = display_name
        self.logged_in = bool(email)

def generate_entity_id():
    return generate_id()

def generate_note_id():
    return generate_id()

def generate_trip_plan_id():
    return generate_id()

def generate_comment_id():
    return generate_id()

def generate_id():
    randid = uuid.uuid4().bytes[:8]
    # Use mod 2**53 so the number can be represented natively in Javascript.
    return struct.unpack('Q', randid)[0] % 2**53    

def trip_plan_filename(creator_identifier, trip_plan_id):
    return os.path.join(constants.PROJECTPATH, 'local_data', 'trip_plan_%s_%s.json' % (creator_identifier, trip_plan_id))

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
    creator_identifier = session_info.db_user.id if session_info.logged_in() else session_info.visitor_id
    return load_all_trip_plans_for_creator(creator_identifier)

def load_all_trip_plans_for_creator(creator_identifier):
    trip_plans = []
    fname_prefix = 'trip_plan_%s_' % creator_identifier
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
    trip_plan_file = open(trip_plan_filename(trip_plan.creator_identifier(), trip_plan.trip_plan_id), 'w')
    trip_plan_file.write(json_str)
    trip_plan_file.close()

def change_creator(trip_plan, new_creator_db_user):
    old_fname = trip_plan_filename(trip_plan.creator_identifier(), trip_plan.trip_plan_id)
    trip_plan.user = DisplayUser(new_creator_db_user.public_id, new_creator_db_user.display_name)
    trip_plan.creator = None
    save_trip_plan(trip_plan)
    os.remove(old_fname)
    return trip_plan
