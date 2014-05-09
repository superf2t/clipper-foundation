from flask import Flask
from flask import json
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request

import admin
import clip_logic
import constants
import data
import sample_sites
from scrapers import trip_plan_creator
import serializable
import serviceimpls
import values

class MyFlask(Flask):
    jinja_options = dict(Flask.jinja_options)
    jinja_options['extensions'].append('jinja2htmlcompress.SelectiveHTMLCompress')

    def get_send_file_max_age(self, name):
        if name in ('js/script.js', 'js/services.js', 'js/clipper.js', 'js/admin.js',
            'css/style.css', 'css/clipper.css', 'css/admin.css'):
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

app.jinja_env.filters['jsbool'] = lambda boolval: 'true' if boolval else 'false'

@app.route('/')
def index():
    return redirect('/trip_plan')
    # session_info = decode_session(request.cookies)
    # response = render_template('index.html', bookmarklet_url=constants.BASE_URL + '/bookmarklet.js')
    # return process_response(response, request, session_info)

@app.route('/clipper_iframe')
def clipper_iframe():
    session_info = decode_session(request.cookies)
    if not session_info.logged_in:
        return render_template('clipper_iframe_not_logged_in.html')
    url = request.values['url']
    needs_client_page_source = clip_logic.needs_client_page_source_to_scrape(url)
    entities = []
    if not needs_client_page_source:
        entities = clip_logic.scrape_entities_from_url(url)
    trip_plan_service = serviceimpls.TripPlanService(session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    if not all_trip_plans:
        # User is so new she doesn't even have an empty trip plan
        trip_plan = create_and_save_default_trip_plan(session_info)
        all_trip_plans = [trip_plan]
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    return render_template('clipper_iframe.html',
        entities_json=serializable.to_json_str(entities),
        needs_client_page_source=needs_client_page_source,
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
    note_service = serviceimpls.NoteService(session_info)
    account_info = data.AccountInfo(session_info.email)

    current_trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    notes = note_service.get(serviceimpls.NoteGetRequest(trip_plan_id)).notes
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    response = render_template('trip_plan.html',
        plan=current_trip_plan,
        entities_json=serializable.to_json_str(entities),
        notes_json=serializable.to_json_str(notes),
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        allow_editing=current_trip_plan and current_trip_plan.editable_by(session_info),
        account_info=account_info,
        bookmarklet_url=constants.BASE_URL + '/bookmarklet.js',
        all_datatype_values=values.ALL_VALUES,
        sample_sites=sample_sites.SAMPLE_SITES)
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

@app.route('/noteservice/<method_name>', methods=['POST'])
def noteservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.NoteService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/tripplanservice/<method_name>', methods=['POST'])
def tripplanservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.TripPlanService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/accountservice/<method_name>', methods=['POST'])
def accountservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.AccountService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return process_response(json.jsonify(response), request, session_info)

@app.route('/adminservice/<method_name>', methods=['POST'])
def adminservice(method_name):
    session_info = decode_session(request.cookies)
    service = serviceimpls.AdminService(session_info)
    response = service.invoke_with_json(method_name, request.json)
    return process_response(json.jsonify(response), request, session_info)

@app.route('/admin')
def adminpage():
    reverse = True if request.values.get('reverse') else False
    trip_plans = admin.fetch_trip_plans(
        sorting=request.values.get('sorting'), reverse=reverse)
    return render_template('admin.html', trip_plans=trip_plans)

@app.route('/admin/editor/<int:trip_plan_id>')
def admin_editor(trip_plan_id):
    session_info = decode_session(request.cookies)
    trip_plan_service = serviceimpls.TripPlanService(session_info)
    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entity_service = serviceimpls.EntityService(session_info)
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    return render_template('admin_editor.html',
        trip_plan=trip_plan,
        entities_json=serializable.to_json_str(entities),
        all_datatype_values=values.ALL_VALUES,
        account_info=data.AccountInfo(session_info.email))

@app.route('/admin/scrape')
def admin_scrape():
    return render_template('admin_scrape.html',
        all_scrapers=[s.__name__ for s in trip_plan_creator.ALL_PARSERS])

def create_and_save_default_trip_plan(session_info):
    operation = serviceimpls.TripPlanOperation(serviceimpls.Operator.ADD.name, data.TripPlan(name='My First Trip'))
    mutate_request = serviceimpls.TripPlanMutateRequest(operations=[operation])
    response = serviceimpls.TripPlanService(session_info).mutate(mutate_request)
    return response.trip_plans[0]

def decode_session(cookies):
    email = cookies.get('email')
    try:
        sessionid = int(cookies.get('sessionid'))
    except:
        sessionid = None
    session_info = data.SessionInfo(email, sessionid)
    session_info.logged_in = sessionid or email
    if not session_info.sessionid:
        session_info.sessionid = data.generate_sessionid()
        session_info.set_on_response = True
    return session_info

def process_response(response, request=None, session_info=None):
    response = make_response(response)
    if session_info and session_info.set_on_response:
        if session_info.email and session_info.email != request.cookies.get('email'):
            set_cookie(response, 'email', session_info.email)
        if session_info.sessionid and session_info.sessionid != request.cookies.get('sessionid'):
            set_cookie(response, 'sessionid', str(session_info.sessionid))
    return response

def set_cookie(response, key, value):
    response.set_cookie(key, value, expires=constants.COOKIE_EXPIRATION_TIME, domain=constants.HOST)


if __name__ == '__main__':
    app.debug = constants.DEBUG
    app.run()
