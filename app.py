import struct
import re
import uuid

from flask import Flask
from flask import json
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request

import clip_logic
import constants
import data
import serializable
import serviceimpls
import values

class MyFlask(Flask):
    def get_send_file_max_age(self, name):
        if name in ('js/script.js', 'js/services.js', 'css/style.css'):
            return 0
        return super(MyFlask, self).get_send_file_max_age(name)

app = MyFlask(__name__)

if not constants.DEBUG:
    import logging
    import os
    projectpath = os.environ.get('PROJECTPATH') or '.'
    file_handler = logging.FileHandler(projectpath + '/app.log')
    file_handler.setLevel(logging.WARNING)
    app.logger.addHandler(file_handler)

EMAIL_RE = re.compile("^[a-zA-Z0-9+_-]+(?:\.[a-zA-Z0-9+_-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9]*[a-zA-Z0-9])?$")

app.jinja_env.filters['jsbool'] = lambda boolval: 'true' if boolval else 'false'

@app.route('/')
def index():
    session_info = decode_session(request.cookies)
    response = render_template('index.html', bookmarklet_url=constants.BASE_URL + '/bookmarklet.js')
    return process_response(response, request, session_info)

@app.route('/clipper_iframe')
def clipper_iframe():
    session_info = decode_session(request.cookies)
    if not session_info.logged_in:
        return render_template('clipper_iframe_not_logged_in.html')
    url = request.values['url']
    needs_page_source = clip_logic.needs_page_source_to_scrape(url)
    entity = None
    if not needs_page_source:
        entity = clip_logic.scrape_entity_from_url(url)
    trip_plan_service = serviceimpls.TripPlanService(session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    if not all_trip_plans:
        # User is so new she doesn't even have an empty trip plan
        trip_plan = create_and_save_default_trip_plan(session_info)
        all_trip_plans = [trip_plan]
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    return render_template('clipper_iframe.html',
        entity=entity,
        needs_page_source=needs_page_source,
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        all_datatype_values=values.ALL_VALUES)

@app.route('/trip_plan')
def trip_plan():
    session_info = decode_session(request.cookies)
    all_trip_plans = data.load_all_trip_plans(session_info)
    if all_trip_plans:
        trip_plan = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))[0]
    else:
        trip_plan = create_and_save_default_trip_plan(session_info)
    response = redirect('/trip_plan/%s' % trip_plan.trip_plan_id)
    return process_response(response, request, session_info)

@app.route('/trip_plan/<int:trip_plan_id>')
def trip_plan_by_id(trip_plan_id):
    # Temporary hack to allow old trip plan ids to redirect to new ones.
    if trip_plan_id > 2**53:
        return redirect('/trip_plan/%s' % str(trip_plan_id)[:15])

    session_info = decode_session(request.cookies)
    trip_plan_service = serviceimpls.TripPlanService(session_info)
    entity_service = serviceimpls.EntityService(session_info)
    account_info = data.AccountInfo(session_info.email)

    current_trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    response = render_template('trip_plan.html',
        plan=current_trip_plan,
        entities_json=serializable.to_json_str(entities),
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        allow_editing=current_trip_plan and current_trip_plan.editable_by(session_info),
        account_info=account_info,
        bookmarklet_url=constants.BASE_URL + '/bookmarklet.js',
        all_datatype_values=values.ALL_VALUES)
    return process_response(response, request, session_info)

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

@app.route('/entityservice/<method_name>', methods=['POST'])
def entityservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.EntityService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/tripplanservice/<method_name>', methods=['POST'])
def tripplanservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.TripPlanService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

def create_and_save_default_trip_plan(session_info):
    operation = serviceimpls.TripPlanOperation(serviceimpls.Operator.ADD.name, data.TripPlan(name='My First Trip'))
    mutate_request = serviceimpls.TripPlanMutateRequest(operations=[operation])
    response = serviceimpls.TripPlanService(session_info).mutate(mutate_request)
    return response.trip_plans[0]

def generate_sessionid():
    sessionid = uuid.uuid4().bytes[:8]
    return struct.unpack('Q', sessionid)[0]

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
    session_info.logged_in = sessionid or email
    if not session_info.sessionid:
        session_info.sessionid = generate_sessionid()
        session_info.set_on_response = True
    if not session_info.active_trip_plan_id:
        session_info.active_trip_plan_id = data.generate_trip_plan_id()
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
    app.debug = constants.DEBUG
    app.run()
