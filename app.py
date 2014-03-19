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
    json_response = handle_clipping(url, sessionid)
    response = make_jsonp_response(request, json_response)
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

@app.route('/getbookmarklet')
def getbookmarklet():
    template_vars = {
        'bookmarklet_url': BASE_URL + '/static/js/bookmarklet.js'
    }
    return render_template('getbookmarklet.html', **template_vars)

def handle_clipping(url, sessionid):
    scr = scraper.build_scraper(url)
    if not scr:
        return {'message': "Don't know how to scrape this url"}
    trip_plan = data.load_trip_plan(sessionid)
    if not trip_plan:
        trip_plan = data.TripPlan('My First Trip')
    address = scr.get_address()
    latlng_json = geocode.lookup_latlng(address)
    latlng = data.LatLng.from_json_obj(latlng_json) if latlng_json else None
    entity = data.Entity(name=scr.get_entity_name(), entity_type=scr.get_entity_type(),
        address=scr.get_address(), latlng=latlng, 
        address_precision=scr.get_address_precision(), rating=scr.get_rating(),
        primary_photo_url=scr.get_primary_photo(), source_url=url)
    trip_plan.entities.append(entity)
    data.save_trip_plan(trip_plan, sessionid)
    return {'message': 'Successfully clipped "%s"' % scr.get_entity_name()}

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
    app.debug = True
    app.run()
