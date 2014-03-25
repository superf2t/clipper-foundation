import struct
import uuid

from flask import Flask
from flask import json
from flask import make_response
from flask import render_template
from flask import request

import data
import geocode
import scraper

app = Flask(__name__)

#BASE_URL = 'http://127.0.0.1:5000'
BASE_URL = 'https://kauaitrip.ngrok.com'

debug = True
if not debug:
    import logging
    import os
    projectpath = os.environ.get('PROJECTPATH') or '.'
    file_handler = logging.FileHandler(projectpath + '/app.log')
    file_handler.setLevel(logging.WARNING)
    app.logger.addHandler(file_handler)

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/clipper')
def clipper():
    return render_template('clipper.html')

@app.route('/clip')
def clip():
    session_info = decode_session(request.cookies)
    url = request.values['url']
    clip_result = handle_clipping(url, session_info)
    all_trip_plans = data.load_all_trip_plans(session_info)
    modal_html = str(render_template('clipper_results_modal.html',
        clip_result=clip_result, all_trip_plans=all_trip_plans, base_url=BASE_URL))
    response = make_jsonp_response(request, {'html': modal_html})
    return process_response(response, request, session_info)

@app.route('/trip_plan/<int:trip_plan_id>')
def trip_plan_by_id(trip_plan_id):
    session_info = decode_session(request.cookies)
    return trip_plan_with_session_info(session_info, trip_plan_id)

@app.route('/trip_plan')
def trip_plan():
    session_info = decode_session(request.cookies)
    return trip_plan_with_session_info(session_info)

def trip_plan_with_session_info(session_info, trip_plan_id=None):
    if trip_plan_id:
        trip_plan = data.load_trip_plan_by_id(trip_plan_id)
    else:
        trip_plan = data.load_trip_plan(session_info)
    trip_plan_json = json.dumps(trip_plan.to_json_obj()) if trip_plan else None
    all_trip_plans = data.load_all_trip_plans(session_info)
    response = render_template('trip_plan.html', plan=trip_plan, plan_json=trip_plan_json,
        all_trip_plans=all_trip_plans,
        allow_editing=trip_plan and trip_plan.editable_by(session_info))
    return process_response(response, request, session_info)

@app.route('/editentity', methods=['POST'])
def editentity():
    session_info = decode_session(request.cookies)
    if not session_info.user_identifier:
        raise Exception('No sessionid found')
    try:
        input_entity = data.Entity.from_json_obj(request.json)
    except:
        raise Exception('Could not parse an Entity from the input')
    trip_plan = data.load_trip_plan(session_info)
    if not trip_plan:
        raise Exception('No trip plan found for this session')
    for i, entity in enumerate(trip_plan.entities):
        if entity.source_url == input_entity.source_url:
            trip_plan.entities[i] = input_entity
            break
    data.save_trip_plan(trip_plan, session_info)
    return json.jsonify(status='Success')


@app.route('/getbookmarklet')
def getbookmarklet():
    template_vars = {
        'bookmarklet_url': BASE_URL + '/static/js/bookmarklet.js'
    }
    return render_template('getbookmarklet.html', **template_vars)


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

    def __init__(self, status, entity=None, trip_plan=None):
        self.status = status
        self.entity = entity
        self.trip_plan = trip_plan

def handle_clipping(url, session_info):
    trip_plan = data.load_trip_plan(session_info)
    result = None
    if not trip_plan:
        trip_plan = data.TripPlan(session_info.active_trip_plan_id, 'My First Trip', creator=session_info.user_identifier)
    if trip_plan.contains_url(url):
        return ClipResult(ClipResult.STATUS_ALREADY_CLIPPED_URL, trip_plan=trip_plan)
    scr = scraper.build_scraper(url)
    if scr.is_base_scraper():
        clipped_page = data.ClippedPage(source_url=url, title=scr.get_page_title())
        trip_plan.clipped_pages.append(clipped_page)
        result = ClipResult(ClipResult.STATUS_SAVED_FOR_LATER, trip_plan=trip_plan)
    else:
        address = scr.get_address()
        latlng_json = geocode.lookup_latlng(address)
        latlng = data.LatLng.from_json_obj(latlng_json) if latlng_json else None
        entity = data.Entity(name=scr.get_entity_name(), entity_type=scr.get_entity_type(),
            address=scr.get_address(), latlng=latlng, 
            address_precision=scr.get_address_precision(), rating=scr.get_rating(),
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
            response.set_cookie('email', session_info.email)
        if session_info.active_trip_plan_id and session_info.active_trip_plan_id != request.cookies.get('active_trip_plan_id'):
            response.set_cookie('active_trip_plan_id', str(session_info.active_trip_plan_id))
        if session_info.sessionid and session_info.sessionid != request.cookies.get('sessionid'):
            response.set_cookie('sessionid', str(session_info.sessionid))
    return response

def make_jsonp_response(request_obj, response_json_obj):
    callback_name = request_obj.args.get('callback')
    response_str = '%s(%s)' % (callback_name, json.dumps(response_json_obj))
    response = make_response(response_str)
    response.mimetype = 'application/javascript'
    return response

if __name__ == '__main__':
    app.debug = debug
    app.run()
