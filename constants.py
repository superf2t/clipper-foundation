import os

PROJECTPATH = os.environ.get('PROJECTPATH')

DEBUG = False

HOST = 'travelclipper.unicyclelabs.com';
BASE_URL = 'https://' + HOST

COOKIE_EXPIRATION_TIME = 'Wed, 4 Mar 2020 20:00:00 GMT'

FLASK_SECRET_KEY = None  # Set this securely in an override

MAIL_USERNAME = 'jamie@unicyclelabs.com'
MAIL_PASSWORD = None  # Set this securely in an override

try:
    from constants_override import *
except ImportError:
    pass
