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
BASE_URL = 'https://travelclipper.ngrok.com'

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
    sessionid = decode_sessionid(request.cookies.get('sessionid'))
    needs_sessionid = False
    if not sessionid:
        sessionid = generate_sessionid()
        needs_sessionid = True
    url = request.values['url']
    clip_result = handle_clipping(url, sessionid)
    modal_html = str(render_template('clipper_results_modal.html',
        clip_result=clip_result, base_url=BASE_URL))
    response = make_jsonp_response(request, {'html': modal_html})
    print str(response)
    if needs_sessionid:
        response.set_cookie('sessionid', str(sessionid))
    return response

@app.route('/trip_plan')
def trip_plan():
    sessionid = decode_sessionid(request.cookies.get('sessionid'))
    needs_sessionid = False
    if not sessionid:
        sessionid = generate_sessionid()
        needs_sessionid = True
    trip_plan = data.load_trip_plan(sessionid)
    response = render_template('trip_plan.html', plan=trip_plan, plan_json=json.dumps(trip_plan.to_json_obj()))
    if needs_sessionid:
        response.set_cookie('sessionid', str(sessionid))
    return response

@app.route('/editentity', methods=['POST'])
def editentity():
    sessionid = decode_sessionid(request.cookies.get('sessionid'))
    if not sessionid:
        raise Exception('No sessionid found')
    try:
        input_entity = data.Entity.from_json_obj(request.json)
    except:
        raise Exception('Could not parse an Entity from the input')
    trip_plan = data.load_trip_plan(sessionid)
    if not trip_plan:
        raise Exception('No trip plan found for this session')
    for i, entity in enumerate(trip_plan.entities):
        if entity.source_url == input_entity.source_url:
            trip_plan.entities[i] = input_entity
            break
    data.save_trip_plan(trip_plan, sessionid)
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

    def __init__(self, status, entity=None):
        self.status = status
        self.entity = entity

def handle_clipping(url, sessionid):
    trip_plan = data.load_trip_plan(sessionid)
    result = None
    if not trip_plan:
        trip_plan = data.TripPlan('My First Trip')
    if trip_plan.contains_url(url):
        return ClipResult(ClipResult.STATUS_ALREADY_CLIPPED_URL)
    scr = scraper.build_scraper(url)
    if not scr:
        clipped_page = data.ClippedPage(source_url=url)
        trip_plan.clipped_pages.append(clipped_page)
        result = ClipResult(ClipResult.STATUS_SAVED_FOR_LATER)
    else:
        address = scr.get_address()
        latlng_json = geocode.lookup_latlng(address)
        latlng = data.LatLng.from_json_obj(latlng_json) if latlng_json else None
        entity = data.Entity(name=scr.get_entity_name(), entity_type=scr.get_entity_type(),
            address=scr.get_address(), latlng=latlng, 
            address_precision=scr.get_address_precision(), rating=scr.get_rating(),
            primary_photo_url=scr.get_primary_photo(), source_url=url)
        trip_plan.entities.append(entity)
        result = ClipResult(ClipResult.STATUS_SUCCESS_KNOWN_SOURCE, entity)
    data.save_trip_plan(trip_plan, sessionid)
    return result

def generate_sessionid():
    sessionid = uuid.uuid4().bytes[:8]
    return struct.unpack('Q', sessionid)[0]

def decode_sessionid(raw_session_id):
    if not raw_session_id:
        return None
    return int(raw_session_id)

def make_jsonp_response(request_obj, response_json_obj):
    callback_name = request_obj.args.get('callback')
    response_str = '%s(%s)' % (callback_name, json.dumps(response_json_obj))
    response = make_response(response_str)
    response.mimetype = 'application/javascript'
    return response

if __name__ == '__main__':
    app.debug = debug
    app.run()
