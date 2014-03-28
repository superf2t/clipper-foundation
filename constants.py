import os

PROJECTPATH = os.environ.get('PROJECTPATH')

DEBUG = False

HOST = 'travelclipper.unicyclelabs.com';
BASE_URL = 'https://' + HOST

COOKIE_EXPIRATION_TIME = 'Wed, 4 Mar 2020 20:00:00 GMT'

try:
    from constants_override import *
except ImportError:
    pass
