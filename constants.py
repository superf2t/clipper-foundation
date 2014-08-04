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

FEATURED_PROFILES_CONFIG_FILE = os.path.join(PROJECTPATH, 'data/guides.csv')

SOURCE_HOST_TO_ICON_URL = {
    'www.bonappetit.com': 'http://www.bonappetit.com/wp-content/themes/bonappetit-2.0.0/i/icons/favicon.ico',
    'www.foodandwine.com': 'http://www.foodandwine.com/favicon.ico',
    'www.frommers.com': "http://www.frommers.com/favicon.ico",
    'www.fodors.com': "http://www.fodors.com/favicon.ico",
    'www.letsgo.com': 'http://www.letsgo.com/favicon.ico',
    'www.lonelyplanet.com': 'http://www.lonelyplanet.com/favicon.ico',
    'www.nytimes.com': 'http://www.nytimes.com/favicon.ico',
    'www.nomadicmatt.com': 'http://www.nomadicmatt.com/wp-content/themes/NomadicMattV2/favicon.ico',
    'www.hemispheresmagazine.com': 'http://www.hemispheresmagazine.com/images/favicon.ico',
    'www.ricksteves.com': 'http://www.ricksteves.com/assets/favicon.ico',
    'www.saveur.com': 'http://www.saveur.com/sites/saveur.com/themes/saveur/favicon.ico',
    'www.travelandleisure.com': 'http://www.travelandleisure.com/favicon.ico',
    'www.thrillist.com': 'http://www.thrillist.com/thrillist_favicon.ico',
    'www.tripadvisor.com': 'http://tripadvisor.com/favicon.ico',
    'www.zagat.com': 'http://www.zagat.com/favicon.ico',
}

SOURCE_HOST_TO_DISPLAY_NAME = {
    'www.bonappetit.com': 'Bon Appetit',
    'www.foodandwine.com': 'Food & Wine',
    'www.foursquare.com': 'Foursquare',
    'foursquare.com': 'Foursquare',
    'www.frommers.com': "Frommer's",
    'www.fodors.com': "Fodor's",
    'www.google.com': 'Google',
    'www.letsgo.com': "Let's Go",
    'www.lonelyplanet.com': 'Lonely Planet',
    'www.nytimes.com': 'The New York Times',
    'www.nomadicmatt.com': 'Nomadic Matt',
    'www.hemispheresmagazine.com': 'United Hemispheres',
    'plus.google.com': 'Google Maps',
    'www.ricksteves.com': 'Rick Steves',
    'www.saveur.com': 'Saveur',
    'www.travelandleisure.com': 'Travel & Leisure',
    'www.thrillist.com': 'Thrillist',
    'www.tripadvisor.com': 'TripAdvisor',
    'www.yelp.com': 'Yelp',
    'www.zagat.com': 'Zagat',
}

TRUSTED_REPUTATION_SOURCES = set([
    'www.airbnb.com',
    'www.booking.com',
    'www.foursquare.com',
    'foursquare.com',
    'www.hotels.com',
    'www.google.com',
    'plus.google.com',
    'www.tripadvisor.com',
    'www.yelp.com',
    'www.zagat.com',
])

try:
    from constants_override import *
except ImportError:
    pass
