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

class Tag(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('tag_id', 'text')

    def __init__(self, tag_id=None, text=None):
        self.tag_id = tag_id
        self.text = text

class OpeningPeriod(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('day_open', 'hour_open', 'minute_open',
        'day_close', 'hour_close', 'minute_close', 'as_string')

    DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    def __init__(self, day_open=None, hour_open=None, minute_open=None,
            day_close=None, hour_close=None, minute_close=None):
        self.day_open = day_open
        self.hour_open = hour_open
        self.minute_open = minute_open
        self.day_close = day_close
        self.hour_close = hour_close
        self.minute_close = minute_close
        self.initialize()

    def initialize(self):
        if not self.day_open:
            self.as_string = None
            return
        if self.day_close is None:
            format = '%(day_open)s %(hour_open)02d:%(minute_open)02d'
        elif self.day_open == self.day_close:
            format = '%(day_open)s %(hour_open)02d:%(minute_open)02d-%(hour_close)02d:%(minute_close)02d'
        else:
            format = '%(day_open)s %(hour_open)02d:%(minute_open)02d - %(day_close)s %(hour_close)02d:%(minute_close)02d'
        self.as_string = format % {
            'day_open': self.DAY_NAMES[self.day_open],
            'hour_open': self.hour_open,
            'minute_open': self.minute_open,
            'day_close': self.DAY_NAMES[self.day_close] if self.day_close is not None else None,
            'hour_close': self.hour_close,
            'minute_close': self.minute_close,
        }

class OpeningHours(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('source_text',
        serializable.objlistf('opening_periods', OpeningPeriod),
        'as_string')

    def __init__(self, source_text=None, opening_periods=()):
        self.source_text = source_text
        self.opening_periods = opening_periods or []
        self.initialize()

    def initialize(self):
        self.as_string = '\n'.join(p.as_string for p in self.opening_periods if p.as_string)

class Entity(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('entity_id', 'name',
        serializable.objf('latlng', LatLng),
        serializable.objf('category', values.Category),
        serializable.objf('sub_category', values.SubCategory),
        'address', 'address_precision',
        'phone_number', serializable.objf('opening_hours', OpeningHours), 'website',
        'rating', 'rating_max', 'review_count',
        'starred', serializable.objlistf('comments', Comment),
        'description', 'primary_photo_url',
        serializable.listf('photo_urls'), serializable.objlistf('tags', Tag),
        'source_url', 'origin_trip_plan_id', 'google_reference', 'last_access',
        'day', 'day_position')

    def __init__(self, entity_id=None, name=None, latlng=None,
            category=None, sub_category=None,
            address=None, address_precision=None,
            phone_number=None, opening_hours=None, website=None,
            rating=None, rating_max=None, review_count=None, 
            starred=None, comments=(),
            description=None, primary_photo_url=None, photo_urls=(), tags=(),
            source_url=None, origin_trip_plan_id=None, google_reference=None,
            last_access=None, last_access_datetime=None,
            day=None, day_position=None):
        self.entity_id = entity_id
        self.name = name
        self.latlng = latlng
        self.category = category
        self.sub_category = sub_category

        self.address = address
        self.address_precision = address_precision
        self.phone_number = phone_number
        self.opening_hours = opening_hours or OpeningHours()
        self.website = website

        self.rating = rating
        self.rating_max = rating_max
        self.review_count = review_count
        self.starred = starred
        self.comments = comments or []

        self.description = description
        self.primary_photo_url = primary_photo_url
        self.photo_urls = photo_urls or []
        self.tags = tags or []

        self.source_url = source_url
        self.origin_trip_plan_id = origin_trip_plan_id
        self.google_reference = google_reference
        self.last_access = last_access
        if last_access_datetime:
            self.set_last_access_datetime(last_access_datetime)

        self.day = day  # Deprecated
        self.day_position = day_position  # Deprecated

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

    def last_access_datetime(self):
        if not self.last_access:
            return None
        return date_parser.parse(self.last_access)

    def set_last_access_datetime(self, d):
        self.last_access = d.isoformat()

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

TripPlanType = enums.enum('NONE', 'GUIDE')

class TripPlan(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id', 'name',
        'location_name', serializable.objf('location_latlng', LatLng),
        serializable.objf('location_bounds', LatLngBounds),
        'description', 'cover_image_url', 'source_url',
        serializable.objlistf('entities', Entity),
        serializable.objlistf('notes', Note),
        'creator', serializable.objf('user', DisplayUser),
        serializable.objlistf('editors', DisplayUser),
        serializable.listf('invitee_emails'),
        'last_modified', 'status',
        'trip_plan_type', serializable.objlistf('tags', Tag),
        'content_date', 'view_count', 'clip_count')

    Status = enums.enum('ACTIVE', 'DELETED')

    def __init__(self, trip_plan_id=None, name=None,
            location_name=None, location_latlng=None, location_bounds=None,
            description=None, cover_image_url=None, source_url=None,
            entities=(), notes=(),
            creator=None, user=None, editors=(), invitee_emails=(),
            last_modified=None, status=Status.ACTIVE.name,
            trip_plan_type=None, tags=(),
            content_date=None, content_date_datetime=None,
            view_count=0, clip_count=0):
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
        self.trip_plan_type = trip_plan_type
        self.tags = tags or []
        self.content_date = content_date
        if content_date_datetime:
            self.set_content_date_datetime(content_date_datetime)
        self.view_count = view_count
        self.clip_count = clip_count

        # TODO: Make these private fields
        self.user = user
        self.creator = creator  # Deprecated in favor of user
        self.editors = editors or []
        self.invitee_emails = invitee_emails or []

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

    def editor_exists(self, editor_public_id):
        for editor in self.editors:
            if editor.public_id == editor_public_id:
                return True
        return False

    def invitee_exists(self, invitee_email):
        invitee = invitee_email.lower()
        for email in self.invitee_emails:
            if email.lower() == invitee:
                return True
        return False

    def remove_editor(self, editor_public_id):
        for i, editor in enumerate(self.editors):
            if editor.public_id == editor_public_id:
                return self.editors.pop(i)
        return None

    def remove_invitee(self, invitee_email):
        for i, email in enumerate(self.invitee_emails):
            if email.lower() == invitee_email.lower():
                return self.invitee_emails.pop(i)
        return None

    def creator_identifier(self):
        if self.user and self.user.public_id:
            return crypto.decrypt_id(self.user.public_id)
        elif self.user and self.user.public_visitor_id:
            return crypto.decrypt_id(self.user.public_visitor_id)
        else:
            return self.creator

    def creator_name(self):
        if self.user and self.user.display_name:
            return self.user.display_name
        elif self.user and self.user.public_visitor_id:
            return self.user.public_visitor_id
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

    def content_date_datetime(self):
        if not self.content_date:
            return None
        return date_parser.parse(self.content_date)

    def set_content_date_datetime(self, d):
        self.content_date = d.isoformat()

    def strip_readonly_fields(self):
        self.entities = ()
        self.notes = ()
        self.creator = None
        self.last_modified = None
        self.editors = ()
        self.invitee_emails = ()
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

    def display_user(self):
        return DisplayUser(self.db_user.public_id if self.db_user else None,
            self.db_user.display_name if self.db_user else None,
            self.public_visitor_id)

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
    PUBLIC_FIELDS = serializable.fields('email',
        serializable.objf('user', DisplayUser), 'logged_in')

    def __init__(self, email=None, user=None):
        self.email = email
        self.user = user
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
