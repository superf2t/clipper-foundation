import os

PROJECTPATH = os.environ.get('PROJECTPATH')

HOST = 'travelclipper.unicyclelabs.com';
BASE_URL = 'https://' + HOST

try:
    from constants_override import *
except ImportError:
    pass
