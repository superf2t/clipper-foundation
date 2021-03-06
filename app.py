import datetime
import urllib
import urlparse

from dateutil import relativedelta
from flask import flash
from flask import g
from flask import get_flashed_messages
from flask import json
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request
from flask import request_finished
from flask import session
from flask import url_for
from flask.ext import user as flask_user
from flask.ext.user import current_user

import admin
from app_core import app
from app_core import db
import cookies
import constants
import csv_export
import data
from database import user as user_module
import experiments
import featured_profiles
import guide_config
import request_logging
import sample_sites
from scraping import trip_plan_creator
import serializable
import serviceimpls
from sessions import session_summary
from sessions import sessionize
import values

app.jinja_env.filters['jsbool'] = lambda boolval: 'true' if boolval else 'false'

FEATURED_CITY_NAMES = ('Bangkok', 'London', 'Paris', 'Barcelona',
    'Rome', 'San Francisco', 'New York', 'Las Vegas', 'Hong Kong')
FEATURED_GUIDE_CONFIGS = [guide_config.GUIDES_BY_CITY[name] for name in FEATURED_CITY_NAMES]
FEATURED_PROFILE_NAMES = ('thenewyorktimes', 'thrillist', 'fodors', 'zagat', 'bonappetit', 'lonelyplanet')
FEATURED_PROFILE_CONFIGS = [featured_profiles.PROFILE_CONFIGS_BY_NAME_TOKEN[name] for name in FEATURED_PROFILE_NAMES]

@app.route('/')
def index():
    index_var = g.session_info.experiments.get('index_variation')
    if index_var:
        return index_variation('index%d.html' % index_var.get_value('var'))
    return index_variation('index1.html')

@app.route('/index')
def old_index():
    return index_variation('index.html')

@app.route('/go')
@app.route('/begin')
@app.route('/start')
def alt_index():
    index_var = {'/go': 1, '/begin': 2, '/start': 3}.get(request.path)
    @after_this_request
    def set_index_var_cookie(response):
        set_cookie(response, 'index_var', str(index_var))
    return index_variation('/index%d.html' % index_var)

def index_variation(template_name):
    return render_template(template_name,
        all_guide_configs=guide_config.GUIDES,
        featured_guide_configs=FEATURED_GUIDE_CONFIGS,
        featured_profile_configs=FEATURED_PROFILE_CONFIGS,
        flashed_messages=[data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)])

@app.route('/get_clipper')
def get_clipper():
    return render_template('get_clipper.html',
        bookmarklet_url=constants.BASE_URL + '/bookmarklet.js',
        internal_bookmarklet_url=constants.BASE_URL  + '/internal_bookmarklet.js')

@app.route('/clipper_iframe')
def clipper_iframe():
    if not (g.session_info.visitor_id or g.session_info.email):
        return render_template('clipper_iframe_not_logged_in.html')
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans or []
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

    source_url = trip_plan_creator.canonicalize_url(request.values.get('url'))
    current_trip_plan = None
    for trip_plan in all_trip_plans:
        if trip_plan.source_url == source_url:
            current_trip_plan = trip_plan
            break
    if not current_trip_plan:
        admin_service = serviceimpls.AdminService(g.session_info)
        parse_request = serviceimpls.ParseTripPlanRequest(url=source_url, augment_entities=False)
        parse_response = admin_service.parsetripplan(parse_request)
        current_trip_plan = parse_response.trip_plan
        all_trip_plans.append(current_trip_plan)

    def comp(x, y):
        if x is current_trip_plan:
            return -1
        if y is current_trip_plan:
            return 1
        return x.compare(y)

    sorted_trip_plans = sorted(all_trip_plans, cmp=comp)
    return render_template('internal_clipper_iframe.html',
        all_trip_plans_json=serializable.to_json_str(sorted_trip_plans),
        all_datatype_values=values.ALL_VALUES)

@app.route('/clipper_map_iframe')
def clipper_map_iframe():
    return render_template('clipper_map_iframe.html')

@app.route('/guide')
def guide():
    all_trip_plans = data.load_all_trip_plans(g.session_info)
    if all_trip_plans:
        trip_plan = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))[0]
        redirect_url = '/guide/%s' % trip_plan.trip_plan_id
    elif g.session_info.logged_in():
        redirect_url = '/profile/' + g.account_info.user.public_id
    else:
        redirect_url = '/'
    return redirect(redirect_url)

@app.route('/guide/<int:trip_plan_id>')
def guide_by_id(trip_plan_id):
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    entity_service = serviceimpls.EntityService(g.session_info)

    current_trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    if current_user and not current_user.is_anonymous() and current_user.email == 'travel@unicyclelabs.com':
        all_trip_plans = []
    else:
        all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    sorted_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    allow_editing = current_trip_plan and current_trip_plan.editable_by(g.session_info)
    if allow_editing:
        # We have it we won't use it since there's no shopping cart.
        active_trip_plan = None
    else:
        active_trip_plan = sorted_trip_plans[0] if sorted_trip_plans else None

    active_entities = None 
    if not allow_editing and active_trip_plan:
        active_entities = entity_service.get(
            serviceimpls.EntityGetRequest(active_trip_plan.trip_plan_id)).entities     
    else:
        # We have them but we won't use them since there's no shopping cart.
        pass

    guide_config_for_destination = guide_config.find_most_prominent_nearby_city_config(
        current_trip_plan.location_latlng)
    has_guides = bool(guide_config_for_destination)
    flashed_messages = [data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)]

    response_str = render_template('trip_plan.html',
        plan=current_trip_plan,
        entities_json=serializable.to_json_str(entities),
        all_trip_plans=sorted_trip_plans,
        active_trip_plan=active_trip_plan,
        allow_editing=allow_editing,
        account_info=g.account_info,
        bookmarklet_url=constants.BASE_URL + '/bookmarklet.js',
        all_datatype_values=values.ALL_VALUES,
        sample_sites_json=serializable.to_json_str(sample_sites.SAMPLE_SITES),
        has_guides=has_guides,
        guide_config_for_destination=guide_config_for_destination,
        flashed_messages=flashed_messages)

    response = make_response(response_str)
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response

@app.route('/guide/<int:trip_plan_id>/print')
def print_trip_plan(trip_plan_id):
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    entity_service = serviceimpls.EntityService(g.session_info)

    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    sorted_entities = sorted(entities, cmp=data.Entity.chronological_cmp)

    return render_template('print_trip_plan.html', trip_plan=trip_plan, entities=sorted_entities)

@app.route('/guide/<int:trip_plan_id>/csv')
def csv_trip_plan(trip_plan_id):
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    entity_service = serviceimpls.EntityService(g.session_info)

    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    sorted_entities = sorted(entities, cmp=data.Entity.chronological_cmp)

    response = make_response(csv_export.create_csv(sorted_entities))
    response.headers['Content-Type'] = 'application/csv'
    response.headers['Content-Disposition'] = 'attachment; filename=%s.csv' % trip_plan.name
    return response

@app.route('/guides/<location>')
def guides(location):
    config = guide_config.GUIDES_BY_CITY_URL_TOKEN.get(location)
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    if config:
        guides_request = serviceimpls.TripPlanGetRequest(config.trip_plan_ids)
        guides = trip_plan_service.get(guides_request).trip_plans
    else:
        guides = []
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    sorted_user_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    flashed_messages = [data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)]
    return render_template('guides.html',
        guides=guides,
        all_trip_plans=sorted_user_trip_plans,
        all_guide_configs=guide_config.GUIDES,
        location_name=config.city_name if config else '',
        flashed_messages=flashed_messages)

@app.route('/profile/<profile_name>')
def profile(profile_name):
    featured_profile_config = featured_profiles.PROFILE_CONFIGS_BY_NAME_TOKEN.get(profile_name)
    is_featured = bool(featured_profile_config)
    if is_featured:
        req = serviceimpls.TripPlanGetRequest(trip_plan_ids=featured_profile_config.trip_plan_ids)
        display_user = data.DisplayUser()
    else:
        try:
            db_user = user_module.User.get_by_public_id(profile_name)
        except:
            return redirect('/')
        req = serviceimpls.TripPlanGetRequest(public_user_id=profile_name)
        display_user = data.DisplayUser(db_user.public_id if db_user else None, db_user.display_name)

    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    trip_plans = trip_plan_service.get(req).trip_plans

    if is_featured and trip_plans and not display_user.display_name:
        display_user.display_name = trip_plans[0].source_display_name

    all_user_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    sorted_user_trip_plans = sorted(all_user_trip_plans, cmp=lambda x, y: x.compare(y))

    viewer_is_owner = not is_featured and g.session_info.logged_in() and current_user.id == db_user.id

    flashed_messages = [data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)]
    return render_template('profile.html',
        display_user=display_user,
        trip_plans=trip_plans,
        viewer_is_owner=viewer_is_owner,
        all_user_trip_plans=sorted_user_trip_plans,
        flashed_messages=flashed_messages)

@app.route('/destinations')
def destinations():
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    all_trip_plans = trip_plan_service.get(serviceimpls.TripPlanGetRequest()).trip_plans
    sorted_user_trip_plans = sorted(all_trip_plans, cmp=lambda x, y: x.compare(y))
    return render_template('destinations.html',
        all_guide_configs=guide_config.GUIDES,
        featured_guide_configs=FEATURED_GUIDE_CONFIGS,
        all_trip_plans=sorted_user_trip_plans,
        flashed_messages=[data.FlashedMessage(message, category) for category, message in get_flashed_messages(with_categories=True)]);


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

@app.route('/tripplanservice/<method_name>', methods=['POST'])
def tripplanservice(method_name):
    service = serviceimpls.TripPlanService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/adminservice/<method_name>', methods=['POST'])
def adminservice(method_name):
    if not g.session_info.is_admin():
        return '', 404
    service = serviceimpls.AdminService(g.session_info)
    response = service.invoke_with_json(method_name, request.json)
    return json.jsonify(response)

@app.route('/xadmin')
@app.route('/admin')
def adminpage():
    if not g.session_info.is_admin():
        return '', 404
    return render_template('admin/admin.html')

@app.route('/xadmin/allguides')
@app.route('/admin/allguides')
def admin_allguides():
    if not g.session_info.is_admin():
        return '', 404
    reverse = True if request.values.get('reverse') else False
    trip_plans = admin.fetch_trip_plans(
        sorting=request.values.get('sorting'), reverse=reverse)
    return render_template('admin/allguides.html', trip_plans=trip_plans,
        source_host=lambda url: urlparse.urlparse(url).netloc.split('.')[-2])

@app.route('/xadmin/recentguides')
@app.route('/admin/recentguides')
def admin_recentguides():
    if not g.session_info.is_admin():
        return '', 404
    trip_plans = admin.load_recent_trip_plans(max=int(request.args.get('max', 20)))
    return render_template('admin/recentguides.html', trip_plans=trip_plans,
        source_host=lambda url: urlparse.urlparse(url).netloc.split('.')[-2])

@app.route('/xadmin/editor/<int:trip_plan_id>')
@app.route('/admin/editor/<int:trip_plan_id>')
def admin_editor(trip_plan_id):
    if not g.session_info.is_admin():
        return '', 404
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entity_service = serviceimpls.EntityService(g.session_info)
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    return render_template('admin_editor.html',
        trip_plan=trip_plan,
        entities_json=serializable.to_json_str(entities),
        all_datatype_values=values.ALL_VALUES,
        account_info=g.account_info)

@app.route('/xadmin/editor/photos/<int:trip_plan_id>')
@app.route('/admin/editor/photos/<int:trip_plan_id>')
def admin_photo_editor(trip_plan_id):
    if not g.session_info.is_admin():
        return '', 404
    trip_plan_service = serviceimpls.TripPlanService(g.session_info)
    trip_plan = trip_plan_service.get(serviceimpls.TripPlanGetRequest([trip_plan_id])).trip_plans[0]
    entity_service = serviceimpls.EntityService(g.session_info)
    entities = entity_service.get(serviceimpls.EntityGetRequest(trip_plan_id)).entities
    return render_template('admin_photo_editor.html',
        trip_plan=trip_plan,
        entities=entities,
        account_info=g.account_info)

@app.route('/admin/scrape')
def admin_scrape():
    if not g.session_info.is_admin():
        return '', 404
    return render_template('admin_scrape.html',
        all_scrapers=[s.__name__ for s in trip_plan_creator.ALL_PARSERS])

@app.route('/xadmin/sessions')
@app.route('/admin/sessions')
def admin_sessions():
    if not g.session_info.is_admin():
        return '', 404
    date = request.args.get('date')
    today = datetime.date.today()
    return render_template('admin/sessions.html',
        date=date,
        day_options=[str(today - relativedelta.relativedelta(days=i)) for i in xrange(7)],
        sessions=session_summary.list_sessions(date))

@app.route('/xadmin/session')
@app.route('/admin/session')
def admin_session():
    if not g.session_info.is_admin():
        return '', 404
    session = sessionize.expand_session(
        request.args.get('visitor_id'), request.args.get('date'))
    return render_template('admin/session.html', session=session)

@app.before_request
def process_cookies():
    if request.path.startswith('/static/') or request.path == '/user/sign-out':
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

    referral_source = request.args.get('source') or request.cookies.get('rsource')
    if request.args.get('source'):
        @after_this_request
        def set_referral_source(response):
            set_cookie(response, 'rsource', request.args.get('source'))
    referral_source_info = request.args.get('sinfo') or request.cookies.get('sinfo')
    if request.args.get('sinfo'):
        @after_this_request
        def set_source_info(response):
            set_cookie(response, 'sinfo', request.args.get('sinfo'))

    g.session_info = data.SessionInfo(email, old_email, visitor_id, db_user,
        referral_source, referral_source_info, experiments.parse_from_cookies(request.cookies))
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
def inject_account_info():
    return {
        'login_iframe_url': url_for('user.login', next=request.url, iframe='1'),
        'register_iframe_url': url_for('user.register', next=request.url, iframe='1'),
        'logout_url': url_for('user.logout', next=request.url),
        'session_info': g.session_info,
        'account_info': g.account_info,
    }

@app.context_processor
def inject_extended_template_builtins():
    return {
        'url_quote_plus': urllib.quote_plus,
        'to_json_str': serializable.to_json_str,
        'is_internal': is_internal(request),
    }

def is_internal(req):
    return req.remote_addr in constants.INTERNAL_IPS

def register():
    flask_user.signals.user_registered.connect(after_registration, app)
    response = flask_user.views.register()
    if hasattr(response, 'status') and response.status == '302 FOUND':
        next_url = '/registration_complete'
        if request.form.get('iframe'):
            next_url += '?iframe=1'
        return redirect(next_url)
    return response

def after_registration(sender, user, **kwargs):
    if g.session_info.referral_source:
        user_metadata = user_module.UserMetadata(user_id=user.id,
            referral_source=g.session_info.referral_source,
            referral_source_info=g.session_info.referral_source_info)
        db.session.add(user_metadata)
        db.session.commit()

def login():
    response = flask_user.views.login()
    if hasattr(response, 'status_code') and response.status_code == 302:
        # HACK: Somewhat baffling but Flask-User does not allow you to pass
        # the remember-me param to Flask-Login when logging in a user.
        # So we just do what that would have done here.
        session['remember'] = 'set'
        if request.args.get('iframe'):
            # HACK: If the login form was filled out correctly we could
            # just target the top frame and let the redirect happen,
            # but if the user makes an error they would get the form
            # with error messages in the top frame instead of the iframe.
            # So we have to make the form target the iframe and render a hack
            # response here that tells the app to reload the page if successful.
            # Note that we're not setting any cookies here, fortunately the login
            # is still working without it.
            return render_template('flask_user/login_iframe_complete.html', next_url=request.args.get('next'))
    return response

def confirm_email(token):
    def handle_trip_plan_migration(sender, user, **kwargs):
        account_service = serviceimpls.AccountService(g.session_info)
        migrate_response = account_service.migrate(serviceimpls.MigrateRequest(user.email))
        if migrate_response.trip_plans:
            if len(migrate_response.trip_plans) > 1:
                msg = ('The guides you created before making an account (%s) '
                    'are now saved in your new account.') % (', '.join(tp.name for tp in migrate_response.trip_plans))
            else:
                msg = ('The guide "%s" you created before making an '
                 'account is now saved in your new account.') % migrate_response.trip_plans[0].name 
            flash(msg, 'success')
    flask_user.signals.user_confirmed_email.connect(handle_trip_plan_migration, app)
    return flask_user.views.confirm_email(token)

# User has finished the registration form but not yet confirmed their email.
@app.route('/registration_complete')
def registration_complete():
    return render_template('flask_user/registration_complete.html')

user_db_adapter = flask_user.SQLAlchemyAdapter(db,  user_module.User)
user_manager = flask_user.UserManager(user_db_adapter, app,
    register_form=user_module.TCRegisterForm,
    register_view_function=register,
    login_view_function=login,
    confirm_email_view_function=confirm_email)

def log_response(send, response, **kwargs):
    request_logging.log_request(request, response, g.get('session_info'))

request_finished.connect(log_response, app)

@app.route('/event')
def event():
    request_logging.log_interaction(request, g.get('session_info'),
        request.args.get('name'), request.args.get('location'), request.args.get('value'))
    return '', 204

if __name__ == '__main__':
    app.debug = constants.DEBUG
    app.run()
