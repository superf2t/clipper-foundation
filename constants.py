import os

PROJECTPATH = os.environ.get('PROJECTPATH')

DEBUG = False

HOST = 'travelclipper.unicyclelabs.com';
BASE_URL = 'https://' + HOST

COOKIE_EXPIRATION_TIME = 'Wed, 4 Mar 2020 20:00:00 GMT'

GOOGLE_PLACES_API_KEY = 'AIzaSyDzW3qolS2BMtVZq1DmrUnsYGDZQ2VUw2k'

try:
    from constants_override import *
except ImportError:
    pass
