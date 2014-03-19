import struct
import uuid

from flask import Flask
from flask import json
from flask import make_response
from flask import render_template
from flask import request

app = Flask(__name__)

BASE_URL = 'http://127.0.0.1:5000'

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
    response = make_jsonp_response(request, {'foo': 'blah'})
    if needs_sessionid:
        response.set_cookie('sessionid', str(sessionid))
    return response

@app.route('/getbookmarklet')
def getbookmarklet():
    template_vars = {
        'bookmarklet_url': BASE_URL + '/static/js/bookmarklet.js'
    }
    return render_template('getbookmarklet.html', **template_vars)

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
