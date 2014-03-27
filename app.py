import struct
import re
import uuid

from flask import Flask
from flask import json
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request

import constants
import data
import scraper
import serializable

app = Flask(__name__)

debug = True
if not debug:
    import logging
    import os
    projectpath = os.environ.get('PROJECTPATH') or '.'
    file_handler = logging.FileHandler(projectpath + '/app.log')
    file_handler.setLevel(logging.WARNING)
    app.logger.addHandler(file_handler)

EMAIL_RE = re.compile("^[a-zA-Z0-9+_-]+(?:\.[a-zA-Z0-9+_-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9]*[a-zA-Z0-9])?$")

@app.route('/')
def index():
    session_info = decode_session(request.cookies)
    response = render_template('index.html', bookmarklet_url=constants.BASE_URL + '/bookmarklet.js')
    return process_response(response, request, session_info)

@app.route('/clip')
def clip():
    session_info = decode_session(request.cookies)
    url = request.values['url']
    if not data.load_trip_plan_by_id(session_info.active_trip_plan_id):
        create_and_save_default_trip_plan(session_info)
    clip_result = handle_clipping(url, session_info.active_trip_plan_id, session_info)
    all_trip_plans = data.load_all_trip_plans(session_info)
    modal_html = render_template('clipper_results_modal.html',
        clip_result=clip_result, all_trip_plans=all_trip_plans, base_url=constants.BASE_URL)
    response = make_jsonp_response(request, {'html': modal_html})
    return process_response(response, request, session_info)

@app.route('/clip_ajax/<int:trip_plan_id>', methods=['POST'])
def clip_ajax(trip_plan_id):
    session_info = decode_session(request.cookies)
    url = request.json['url']
    clip_result = handle_clipping(url, trip_plan_id, session_info)
    response = json.jsonify(clip_status=clip_result.status,
        entity=clip_result.entity.to_json_obj() if clip_result.entity else None)
    return process_response(response, request, session_info)

@app.route('/undoclip')
def undoclip():
    session_info = decode_session(request.cookies)
    url = request.values['url']
    clip_status = ClipResult.STATUS_ERROR
    trip_plan = data.load_trip_plan_by_id(session_info.active_trip_plan_id)
    if not trip_plan:
        clip_status.ClipResult.STATUS_NO_TRIP_PLAN_FOUND
        entity = None
    else:
        entity = trip_plan.remove_entity_by_source_url(url)
        data.save_trip_plan(trip_plan)
        clip_status = ClipResult.STATUS_UNDO_SUCCESS
    clip_result = ClipResult(clip_status, entity=entity, trip_plan=trip_plan)
    all_trip_plans = data.load_all_trip_plans(session_info)
    modal_html = render_template('clipper_results_modal.html',
        clip_result=clip_result, all_trip_plans=all_trip_plans, base_url=constants.BASE_URL)
    response = make_jsonp_response(request, {'html': modal_html})
    return process_response(response, request, session_info)

@app.route('/make_active/<int:trip_plan_id>')
def make_active(trip_plan_id):
    session_info = decode_session(request.cookies)
    if trip_plan_id == 0:
        new_trip_plan_id = generate_trip_plan_id()
        session_info.active_trip_plan_id = new_trip_plan_id
        session_info.set_on_response = True
        trip_plan = create_and_save_default_trip_plan(session_info)
    else:
        trip_plan = data.load_trip_plan_by_id(trip_plan_id)
        if trip_plan and trip_plan.editable_by(session_info) and trip_plan_id != session_info.active_trip_plan_id:
            session_info.active_trip_plan_id = trip_plan_id
            session_info.set_on_response = True
    response = render_template('make_active_response.html')
    return process_response(response, request, session_info)

@app.route('/trip_plan/<int:trip_plan_id>')
def trip_plan_by_id(trip_plan_id):
    session_info = decode_session(request.cookies)
    return trip_plan_with_session_info(session_info, trip_plan_id)

@app.route('/trip_plan')
def trip_plan():
    session_info = decode_session(request.cookies)
    trip_plan = data.load_trip_plan_by_id(session_info.active_trip_plan_id)
    if not trip_plan:
        trip_plan = create_and_save_default_trip_plan(session_info)
    response = redirect('/trip_plan/%s' % session_info.active_trip_plan_id)
    return process_response(response, request, session_info)

def trip_plan_with_session_info(session_info, trip_plan_id=None):
    if trip_plan_id:
        trip_plan = data.load_trip_plan_by_id(trip_plan_id)
    else:
        trip_plan = data.load_trip_plan(session_info)
    trip_plan_json = json.dumps(trip_plan.to_json_obj()) if trip_plan else None
    all_trip_plans = data.load_all_trip_plans(session_info)
    active_trip_plan = None
    for plan in all_trip_plans:
        if plan.trip_plan_id == session_info.active_trip_plan_id:
            active_trip_plan = plan
            break
    all_trip_plans_settings = [tp.as_settings() for tp in all_trip_plans]
    account_info = data.AccountInfo(session_info.email,
        active_trip_plan_id=active_trip_plan.trip_plan_id if active_trip_plan else None,
        active_trip_plan_name=active_trip_plan.name if active_trip_plan else None)
    response = render_template('trip_plan.html', plan=trip_plan, plan_json=trip_plan_json,
        all_trip_plans_settings_json=serializable.to_json_str(all_trip_plans_settings),
        session_info=session_info,
        allow_editing=trip_plan and trip_plan.editable_by(session_info),
        account_info=account_info)
    return process_response(response, request, session_info)

@app.route('/trip_plan_ajax/<int:trip_plan_id>')
def trip_plan_ajax(trip_plan_id):
    session_info = decode_session(request.cookies)
    trip_plan = data.load_trip_plan_by_id(trip_plan_id)
    return json.jsonify(trip_plan=trip_plan and trip_plan.to_json_obj())

@app.route('/new_trip_plan_ajax', methods=['POST'])
def new_trip_plan_ajax():
    session_info = decode_session(request.cookies)
    if not session_info.email:
        raise Exception('User is not logged in')
    new_trip_plan_id = generate_trip_plan_id()
    session_info.active_trip_plan_id = new_trip_plan_id
    session_info.set_on_response = True
    trip_plan = create_and_save_default_trip_plan(session_info)
    response = json.jsonify(new_trip_plan_id_str=str(session_info.active_trip_plan_id))
    return process_response(response, request, session_info)

@app.route('/editentity', methods=['POST'])
def editentity():
    session_info = decode_session(request.cookies)
    if not session_info.user_identifier:
        raise Exception('No sessionid found')
    try:
        edit_request = data.EditEntityRequest.from_json_obj(request.json)
    except:
        raise Exception('Could not parse an EditEntityEntity from the input')
    trip_plan = data.load_trip_plan_by_id(edit_request.trip_plan_id)
    if not trip_plan:
        raise Exception('No trip plan found for the given id')
    if not trip_plan.editable_by(session_info):
        raise Exception('Trip plan not editable by current user')
    for i, entity in enumerate(trip_plan.entities):
        if entity.source_url == edit_request.entity.source_url:
            trip_plan.entities[i] = edit_request.entity
            break
    data.save_trip_plan(trip_plan)
    return json.jsonify(status='Success')

@app.route('/deleteentity', methods=['POST'])
def deleteentity():
    session_info = decode_session(request.cookies)
    if not session_info.user_identifier:
        raise Exception('No sessionid found')
    delete_request = data.DeleteEntityRequest.from_json_obj(request.json)
    if not delete_request:
        raise Exception('Could not parse a delete request from the input')
    trip_plan = data.load_trip_plan_by_id(delete_request.trip_plan_id)
    if not trip_plan:
        raise Exception('No trip plan found')
    if not trip_plan.editable_by(session_info):
        raise Exception('Trip plan not editable by current user')
    trip_plan.remove_entity_by_source_url(delete_request.source_url)
    data.save_trip_plan(trip_plan)
    return json.jsonify(status='Success')

@app.route('/edittripplan', methods=['POST'])
def edittripplan():
    session_info = decode_session(request.cookies)
    if not session_info.user_identifier:
        raise Exception('No sessionid found')
    status = None
    print request.json
    try:
        edit_request = data.EditTripPlanRequest.from_json_obj(request.json)
    except Exception as e:
        print e
        return json.jsonify(status='Could not parse an EditTripPlanRequest from the input')
    if not edit_request.trip_plan_id:
        return json.jsonify(status='No valid id in the EditTripPlanRequest')
    trip_plan = data.load_trip_plan_by_id(edit_request.trip_plan_id)
    if not trip_plan:
        return json.jsonify(status='No trip plan found with id %s' % edit_request.trip_plan_id)
    if not trip_plan.editable_by(session_info):
        return json.jsonify(status='User is not allowed to edit this trip plan')
    if not edit_request.name:
        return json.jsonify(status='Cannot save a trip plan without a name')
    trip_plan.name = edit_request.name
    data.save_trip_plan(trip_plan)
    return json.jsonify(status='Success')

@app.route('/login_and_migrate_ajax', methods=['POST'])
def login_and_migrate_ajax():
    session_info = decode_session(request.cookies)
    email = request.json['email']
    if not email or not EMAIL_RE.match(email):
        return json.jsonify(status='Invalid email')
    email = email.lower()
    if session_info.email:
        session_info.active_trip_plan_id = None
        session_info.clear_active_trip_plan_id = True
    else:
        all_trip_plans = data.load_all_trip_plans(session_info) or []
        for trip_plan in all_trip_plans:
            data.change_creator(trip_plan, email)
    session_info.email = email
    session_info.set_on_response = True
    response = json.jsonify(status='Success')
    return process_response(response, request, session_info)

@app.route('/bookmarklet.js')
def bookmarklet_js():
    response = make_response(render_template('bookmarklet.js', host=constants.HOST))
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/trip_plan_kauai')
def trip_plan_kauai():
    kauai_trip_plan_id = 'kauai'
    trip_plan = data.load_trip_plan(kauai_trip_plan_id)
    response = render_template('trip_plan.html',
        plan=trip_plan, plan_json=json.dumps(trip_plan.to_json_obj()),
        allow_editing=False)
    return response    

class ClipResult(object):
    STATUS_ERROR = 0
    STATUS_SUCCESS_KNOWN_SOURCE = 1
    STATUS_SAVED_FOR_LATER = 2
    STATUS_ALREADY_CLIPPED_URL = 3
    STATUS_NO_TRIP_PLAN_FOUND = 4
    STATUS_UNDO_SUCCESS = 5

    def __init__(self, status, entity=None, trip_plan=None):
        self.status = status
        self.entity = entity
        self.trip_plan = trip_plan

def create_and_save_default_trip_plan(session_info):
    trip_plan = data.TripPlan(session_info.active_trip_plan_id, 'My First Trip', creator=session_info.user_identifier)
    data.save_trip_plan(trip_plan)
    return trip_plan

def handle_clipping(url, trip_plan_id, session_info):
    trip_plan = data.load_trip_plan_by_id(trip_plan_id)
    result = None
    if not trip_plan:
        raise Exception('No trip plan found with id %s' % trip_plan_id)
    if not trip_plan.editable_by(session_info):
        raise Exception('User does not have permission to clip to this trip plan')
    if trip_plan.contains_url(url):
        return ClipResult(ClipResult.STATUS_ALREADY_CLIPPED_URL, trip_plan=trip_plan)
    scr = scraper.build_scraper(url)
    if scr.is_base_scraper():
        clipped_page = data.ClippedPage(source_url=url, title=scr.get_page_title())
        trip_plan.clipped_pages.append(clipped_page)
        result = ClipResult(ClipResult.STATUS_SAVED_FOR_LATER, trip_plan=trip_plan)
    else:
        address = scr.get_address()
        location = scr.lookup_location()
        latlng = data.LatLng.from_json_obj(location.latlng_json()) if location else None
        address_precision = 'Precise' if location and location.is_precise() else 'Imprecise'
        entity = data.Entity(name=scr.get_entity_name(), entity_type=scr.get_entity_type(),
            address=scr.get_address(), latlng=latlng, 
            address_precision=address_precision, rating=scr.get_rating(),
            primary_photo_url=scr.get_primary_photo(), photo_urls=scr.get_photos(),
            source_url=url)
        trip_plan.entities.append(entity)
        result = ClipResult(ClipResult.STATUS_SUCCESS_KNOWN_SOURCE, entity, trip_plan)
    data.save_trip_plan(trip_plan)
    return result

def generate_sessionid():
    sessionid = uuid.uuid4().bytes[:8]
    return struct.unpack('Q', sessionid)[0]

def generate_trip_plan_id():
    return generate_sessionid()

def decode_session(cookies):
    email = cookies.get('email')
    try:
        active_trip_plan_id = int(cookies.get('active_trip_plan_id'))
    except:
        active_trip_plan_id = None
    try:
        sessionid = int(cookies.get('sessionid'))
    except:
        sessionid = None
    session_info = data.SessionInfo(email, active_trip_plan_id, sessionid)
    if not session_info.sessionid:
        session_info.sessionid = generate_sessionid()
        session_info.set_on_response = True
    if not session_info.active_trip_plan_id:
        session_info.active_trip_plan_id = generate_trip_plan_id()
        session_info.set_on_response = True
    return session_info

def process_response(response, request=None, session_info=None):
    response = make_response(response)
    if session_info and session_info.set_on_response:
        if session_info.email and session_info.email != request.cookies.get('email'):
            set_cookie(response, 'email', session_info.email)
        if session_info.active_trip_plan_id and session_info.active_trip_plan_id != request.cookies.get('active_trip_plan_id'):
            set_cookie(response, 'active_trip_plan_id', str(session_info.active_trip_plan_id))
        elif session_info.clear_active_trip_plan_id:
            set_cookie(response, 'active_trip_plan_id', '')
        if session_info.sessionid and session_info.sessionid != request.cookies.get('sessionid'):
            set_cookie(response, 'sessionid', str(session_info.sessionid))
    return response

def set_cookie(response, key, value):
    response.set_cookie(key, value, expires=constants.COOKIE_EXPIRATION_TIME, domain=constants.HOST)

def make_jsonp_response(request_obj, response_json_obj):
    callback_name = request_obj.args.get('callback')
    response_str = '%s(%s)' % (callback_name, json.dumps(response_json_obj))
    response = make_response(response_str)
    response.mimetype = 'application/javascript'
    return response

if __name__ == '__main__':
    app.debug = debug
    app.run()
