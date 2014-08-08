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

INTERNAL_IPS = ('70.36.237.242', '50.152.196.239', '127.0.0.1')

FEATURED_CITIES_CONFIG_FILE = os.path.join(PROJECTPATH, 'data/guide_configs.csv')
FEATURED_PROFILES_CONFIG_FILE = os.path.join(PROJECTPATH, 'data/guides.csv')

SOURCE_HOST_TO_ICON_URL = {
    'www.bonappetit.com': 'http://www.bonappetit.com/wp-content/uploads/2013/08/bon-appetit-icon-250x250.jpg',
    'www.foodandwine.com': 'http://www.foodandwine.com/favicon.ico',
    'www.frommers.com': "http://www.aroundtheworlds.com/fr/wp-content/uploads/2014/01/icon-frommers1.png",
    'www.fodors.com': "http://a3.mzstatic.com/us/r30/Purple/v4/0f/56/36/0f5636eb-6c28-2735-fe4a-65365a576a76/icon_256.png",
    'www.letsgo.com': 'https://s3.amazonaws.com/static.letsgo.com/pages/mobile/icons/LG+App+Icon.png',
    'www.lonelyplanet.com': 'https://gp4.googleusercontent.com/--ILPmaHN710/AAAAAAAAAAI/AAAAAAAAALw/fHvDhNGES0E/s48-c-k-no/photo.jpg',
    'www.nytimes.com': 'http://www.mirrorservice.org/sites/addons.superrepo.org/addons/frodo/plugin.video.newyorktimes/icon.png',
    'www.nomadicmatt.com': 'http://www.nomadicmatt.com/wp-content/themes/NomadicMattV2/images/Nomadic_Matt-logo.png',
    'www.hemispheresmagazine.com': 'http://a5.mzstatic.com/us/r30/Purple4/v4/69/1f/b1/691fb177-eb8f-be1b-383b-57f9f3283270/icon_256.png',
    'www.ricksteves.com': 'https://lh6.googleusercontent.com/-JMraKPalP80/AAAAAAAAAAI/AAAAAAAAABI/18wMvzLN_RI/photo.jpg',
    'www.saveur.com': 'http://a2.mzstatic.com/us/r30/Purple4/v4/d1/ce/6e/d1ce6e3c-8efb-f0cf-d765-779c04d3abca/icon_256.png',
    'www.travelandleisure.com': 'http://a3.mzstatic.com/us/r30/Purple4/v4/08/db/c2/08dbc270-fe06-f528-5c5e-00f831485563/icon_256.png',
    'www.thrillist.com': 'http://pbs.twimg.com/profile_images/3406986054/99d1ee1e35cc2f1376af0ab734882fa5.jpeg',
    'www.tripadvisor.com': 'http://d1hwvnnkb0v1bo.cloudfront.net/content/art/app/icons/tripadvisor_icon.jpg',
    'www.zagat.com': 'http://www.sorellecafe.com/images/zag-icon.gif',
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
