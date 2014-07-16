import urllib

from flask import flash
from flask import g
from flask import get_flashed_messages
from flask import json
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request
from flask import url_for
from flask.ext import login as flask_login
from flask.ext import user as flask_user
from flask.ext.user import current_user

import admin
from app_core import app
from app_core import db
import cookies
import constants
import data
from database import user
import sample_sites
from scraping import trip_plan_creator
import serializable
import serviceimpls
import values

app.jinja_env.filters['jsbool'] = lambda boolval: 'true' if boolval else 'false'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_clipper')
def get_clipper():
    return render_template('get_clipper.html', bookmarklet_url=constants.BASE_URL + '/bookmarklet.js')

@app.route('/clipper_iframe')
def clipper_iframe():
    if not (g.session_info.visitor_id or g.session_info.email):
        return render_template('clipper_iframe_not_logged_in.html')
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    if not all_trip_plans:
        # User is so new she doesn't even have an empty trip plan
        trip_plan = create_and_save_default_trip_plan(g.session_info)
        all_trip_plans = [trip_plan]
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    return render_template('clipper_iframe.html',
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        all_datatype_values=values.ALL_VALUES)

@app.route('/internal_clipper_iframe')
def internal_clipper_iframe():
    if not (g.session_info.visitor_id or g.session_info.email):
        return render_template('clipper_iframe_not_logged_in.html')

    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))

    source_url = request.values.get('url')
    current_trip_plan = None
    current_entities = ()
    for trip_plan in all_trip_plans:
        if trip_plan.source_url == source_url:
            current_trip_plan = trip_plan
            entity_service = serviceimpls.EntityService(g.session_info)
            current_entities = entity_service.get(serviceimpls.EntityGetRequest(
                current_trip_plan.trip_plan_id)).entities
            break
    if not current_trip_plan:
        admin_service = serviceimpls.AdminService(g.session_info)
        parse_request = serviceimpls.ParseTripPlanRequest(url=source_url, augment_entities=False)
        parse_response = admin_service.parsetripplan(parse_request)
        current_trip_plan = parse_response.trip_plan
        current_entities = parse_response.entities

    return render_template('internal_clipper_iframe.html',
        current_trip_plan=current_trip_plan,
        current_entities=current_entities,
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        all_datatype_values=values.ALL_VALUES)

@app.route('/clipper_map_iframe')
def clipper_map_iframe():
    return render_template('clipper_map_iframe.html')

@app.route('/trip_plan')
def trip_plan():
    all_trip_plans = data.load_all_trip_plans(g.session_info)
    if all_trip_plans and not request.values.get('tutorial'):
        trip_plan = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))[0]
    else:
        trip_plan = create_and_save_default_trip_plan(g.session_info)
    redirect_url = '/trip_plan/%s' % trip_plan.trip_plan_id
    if request.values.get('tutorial'):
        redirect_url += '?tutorial=1'
    return redirect(redirect_url)

@app.route('/trip_plan/<int:trip_plan_id>')
def trip_plan_by_id(trip_plan_id):
    # Temporary hack to allow old trip plan ids to redirect to new ones.
    if trip_plan_id > 2**53:
        return redirect('/trip_plan/%s' % str(trip_plan_id)[:15])

    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    entity_service = serviceimpls.EntityService(g.session_info)
    note_service = serviceimpls.NoteService(g.session_info)

    current_trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    notes = note_service.get(serviceimpls.NoteGetRequest(trip_plan_id)).notes
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    allow_editing = current_trip_plan and current_trip_plan.editable_by(g.session_info)
    needs_tutorial = (allow_editing and len(all_trip_plans) == 1 and not entities) or (
        request.values.get('tutorial') and not entities)
    initial_state = data.InitialPageState(request.values.get('sort'),
        needs_tutorial=needs_tutorial)

    flashed_messages = [data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)]

    response = render_template('trip_plan.html',
        plan=current_trip_plan,
        entities_json=serializable.to_json_str(entities),
        notes_json=serializable.to_json_str(notes),
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        allow_editing=allow_editing,
        needs_tutorial=needs_tutorial,
        account_info=g.account_info,
        session_info=g.session_info,
        bookmarklet_url=constants.BASE_URL + '/bookmarklet.js',
        all_datatype_values=values.ALL_VALUES,
        sample_sites_json=serializable.to_json_str(sample_sites.SAMPLE_SITES),
        initial_state=initial_state,
        flashed_messages=flashed_messages)
    return response

@app.route('/trip_plan/<int:trip_plan_id>/print')
def print_trip_plan(trip_plan_id):
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    entity_service = serviceimpls.EntityService(g.session_info)

    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    sorted_entities = sorted(entities, cmp=data.Entity.chronological_cmp)

    return render_template('print_trip_plan.html', trip_plan=trip_plan, entities=sorted_entities)

@app.route('/bookmarklet.js')
def bookmarklet_js():
    response = make_response(render_template('bookmarklet.js', host=constants.HOST))
    response.headers['Content-Type'] = 'application/javascript'
    return response 

@app.route('/internal_bookmarklet.js')
def internal_bookmarklet_js():
    response = make_response(render_template('internal_bookmarklet.js', host=constants.HOST))
    response.headers['Content-Type'] = 'application/javascript'
    return response 

@app.route('/entityservice/<method_name>', methods=['POST'])
def entityservice(method_name):
    service = serviceimpls.EntityService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/noteservice/<method_name>', methods=['POST'])
def noteservice(method_name):
    service = serviceimpls.NoteService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/tripplanservice/<method_name>', methods=['POST'])
def tripplanservice(method_name):
    service = serviceimpls.TripPlanService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/adminservice/<method_name>', methods=['POST'])
def adminservice(method_name):
    service = serviceimpls.AdminService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/admin')
def adminpage():
    reverse = True if request.values.get('reverse') else False
    trip_plans = admin.fetch_trip_plans(
        sorting=request.values.get('sorting'), reverse=reverse)
    return render_template('admin.html', trip_plans=trip_plans)

@app.route('/admin/editor/<int:trip_plan_id>')
def admin_editor(trip_plan_id):
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entity_service = serviceimpls.EntityService(g.session_info)
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    return render_template('admin_editor.html',
        trip_plan=trip_plan,
        entities_json=serializable.to_json_str(entities),
        all_datatype_values=values.ALL_VALUES,
        account_info=g.account_info)

@app.route('/admin/scrape')
def admin_scrape():
    return render_template('admin_scrape.html',
        all_scrapers=[s.__name__ for s in trip_plan_creator.ALL_PARSERS])

def create_and_save_default_trip_plan(session_info):
    operation = serviceimpls.TripPlanOperation(serviceimpls.Operator.ADD.name, data.TripPlan(name='My First Trip'))
    mutate_request = serviceimpls.TripPlanMutateRequest(operations=[operation])
    response = serviceimpls.TripPlanService(session_info).mutate(mutate_request)
    return response.trip_plans[0]

@app.before_request
def process_cookies():
    if request.path.startswith('/static/'):
        return
    try:
        old_sessionid = int(request.cookies.get('sessionid'))
    except:
        old_sessionid = None
    visitor_id = cookies.visitor_id_from_token(request.cookies.get('visitor'))
    if not visitor_id:
        visitor_id = old_sessionid or cookies.generate_visitor_id()
        visitor_token = cookies.make_visitor_token(visitor_id)
        @after_this_request
        def set_visitor_cookie(response):
            set_cookie(response, 'visitor', visitor_token)
        if old_sessionid:
            @after_this_request
            def clear_old_sessionid(response):
                clear_cookie(response, 'sessionid')

    old_email = request.cookies.get('email')
    db_user = current_user if not current_user.is_anonymous() else None
    email = db_user.email if db_user else None
    display_name = db_user.display_name if db_user else old_email
    g.session_info = data.SessionInfo(email, old_email, visitor_id, db_user)
    display_user = data.DisplayUser(db_user.public_id if db_user else None, display_name, g.session_info.public_visitor_id)
    g.account_info = data.AccountInfo(email, display_user)
        
def set_cookie(response, key, value):
    response.set_cookie(key, value, expires=constants.COOKIE_EXPIRATION_TIME, domain=constants.HOST)

def clear_cookie(response, key):
    response.set_cookie(key, '', expires=0)

# Used as a decorator
def after_this_request(f):
    if not hasattr(g, 'after_request_callbacks'):
        g.after_request_callbacks = []
    g.after_request_callbacks.append(f)
    return f

@app.after_request
def call_after_request_callbacks(response):
    for callback in getattr(g, 'after_request_callbacks', ()):
        callback(response)
    return response

@app.context_processor
def inject_login_urls():
    return {
        'login_iframe_url': url_for('user.login', next=request.url, iframe='1'),
        'logout_url': url_for('user.logout', next=request.url),
    }

@app.context_processor
def inject_extended_template_builtins():
    return {
        'url_quote_plus': urllib.quote_plus,
        'to_json_str': serializable.to_json_str,
    }

def register():
    response = flask_user.views.register()
    if hasattr(response, 'status') and response.status == '302 FOUND':
        next_url = '/registration_complete'
        if request.form.get('iframe'):
            next_url += '?iframe=1'
        return redirect(next_url)
    return response

def confirm_email(token):
    def handle_trip_plan_migration(sender, user, **kwargs):
        account_service = serviceimpls.AccountService(g.session_info)
        migrate_response = account_service.migrate(serviceimpls.MigrateRequest(user.email))
        if migrate_response.trip_plans:
            if len(migrate_response.trip_plans) > 1:
                msg = ('The trip plans you created before making an account (%s) '
                    'are now saved in your new account.') % (', '.join(tp.name for tp in migrate_response.trip_plans))
            else:
                msg = ('The trip plan "%s" you created before making an '
                 'account is now saved in your new account.') % migrate_response.trip_plans[0].name 
            flash(msg, 'success')
    flask_user.signals.user_confirmed_email.connect(handle_trip_plan_migration, app)
    return flask_user.views.confirm_email(token)

# User has finished the registration form but not yet confirmed their email.
@app.route('/registration_complete')
def registration_complete():
    return render_template('flask_user/registration_complete.html')

user_db_adapter = flask_user.SQLAlchemyAdapter(db,  user.User)
user_manager = flask_user.UserManager(user_db_adapter, app,
    register_form=user.TCRegisterForm,
    register_view_function=register,
    confirm_email_view_function=confirm_email)


if __name__ == '__main__':
    app.debug = constants.DEBUG
    app.run()
