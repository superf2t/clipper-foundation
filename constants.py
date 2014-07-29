import os

PROJECTPATH = os.environ.get('PROJECTPATH')

DEBUG = False

HOST = 'travelclipper.unicyclelabs.com';
BASE_URL = 'https://' + HOST

COOKIE_EXPIRATION_TIME = 'Wed, 4 Mar 2020 20:00:00 GMT'

FLASK_SECRET_KEY = None  # Set this securely in an override

PUBLIC_ID_ENCRYPTION_KEY = None  # Set this securely in an override

SQLALCHEMY_DATABASE_URI = 'postgresql://localhost/travelclipper'

MAIL_USERNAME = 'jamie@unicyclelabs.com'
MAIL_PASSWORD = None  # Set this securely in an override

SOURCE_HOST_TO_ICON_URL = {
    'www.bonappetit.com': 'http://www.bonappetit.com/wp-content/themes/bonappetit-2.0.0/i/icons/favicon.ico',
    'www.frommers.com': "http://www.frommers.com/favicon.ico",
    'www.fodors.com': "http://www.fodors.com/favicon.ico",
    'www.lonelyplanet.com': 'http://www.lonelyplanet.com/favicon.ico',
    'www.nytimes.com': 'http://www.nytimes.com/favicon.ico',
    'www.nomadicmatt.com': 'http://www.nomadicmatt.com/favicon.ico',
    'www.hemispheresmagazine.com': 'http://www.hemispheresmagazine.com/images/favicon.ico',
    'www.ricksteves.com': 'http://www.ricksteves.com/assets/favicon.ico',
    'www.travelandleisure.com': 'http://www.travelandleisure.com/favicon.ico',
    'www.thrillist.com': 'http://www.thrillist.com/thrillist_favicon.ico',
    'www.tripadvisor.com': 'http://tripadvisor.com/favicon.ico',
    'www.zagat.com': 'http://www.zagat.com/favicon.ico',
}

SOURCE_HOST_TO_DISPLAY_NAME = {
    'www.bonappetit.com': 'Bon Appetit',
    'www.foursquare.com': 'Foursquare',
    'foursquare.com': 'Foursquare',
    'www.frommers.com': "Frommer's",
    'www.fodors.com': "Fodor's",
    'www.google.com': 'Google',
    'www.lonelyplanet.com': 'Lonely Planet',
    'www.nytimes.com': 'The New York Times',
    'www.nomadicmatt.com': 'Nomadic Matt',
    'www.hemispheresmagazine.com': 'United Hemispheres',
    'plus.google.com': 'Google Maps',
    'www.ricksteves.com': 'Rick Steves',
    'www.travelandleisure.com': 'Travel & Leisure',
    'www.thrillist.com': 'Thrillist',
    'www.tripadvisor.com': 'TripAdvisor',
    'www.yelp.com': 'Yelp',
    'www.zagat.com': 'Zagat',
}

try:
    from constants_override import *
except ImportError:
    pass
