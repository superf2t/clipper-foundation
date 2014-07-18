import json
import httplib2
import urllib2

import constants
import data
import utils
import values

def lookup_place_by_reference(reference):
    if not reference:
        return None
    url = 'https://maps.googleapis.com/maps/api/place/details/json?sensor=false&key=%s&reference=%s' % (
        constants.GOOGLE_PLACES_API_KEY, reference)
    response = urllib2.urlopen(url).read()
    data = json.loads(response)
    try:
        return PlaceDetails(data['result'])
    except:
        return None

def resolve_photo_url(photo_reference, maxwidth, maxheight):
    h = httplib2.Http()
    h.follow_redirects = False
    url = 'https://maps.googleapis.com/maps/api/place/photo?sensor=false&key=%s&photoreference=%s&maxwidth=%s&maxheight=%s' % (
        constants.GOOGLE_PLACES_API_KEY, photo_reference, maxwidth, maxheight)
    response, body = h.request(url)
    return response['location']

class PlaceDetails(object):
    def __init__(self, place_json):
        self.place_json = place_json

    def to_entity(self):
        js = self.place_json
        location = js['geometry']['location']
        return data.Entity(
            name=js['name'],
            category=PlaceDetails.types_to_category(js.get('types')),
            sub_category=PlaceDetails.types_to_sub_category(js.get('types')),
            address=js['formatted_address'],
            latlng=data.LatLng(lat=location['lat'], lng=location['lng']),
            address_precision='Precise',  # TODO
            phone_number=js.get('international_phone_number') or js.get('formatted_phone_number'),
            website=js.get('website'),
            opening_hours=PlaceDetails.parse_opening_hours(js.get('opening_hours')),
            rating=js.get('rating'),
            rating_max=5,
            source_url=js.get('url'),
            photo_urls=PlaceDetails.make_photo_urls(js.get('photos', ())),
            google_reference=js['reference']
            )

    @staticmethod
    def make_photo_urls(photo_objs):
        return utils.parallelize(resolve_photo_url,
            [(obj['photo_reference'], obj['width'], obj['height']) for obj in photo_objs])

    CATEGORY_TO_GOOGLE_TYPES = {
        values.Category.FOOD_AND_DRINK: ('bar', 'restaurant', 'cafe',
            'food', 'bakery', 'cafe', 'night_club', 'grocery_or_supermarket', 'liquor_store'),
        values.Category.LODGING: ('lodging', 'campground'),
        values.Category.TRANSPORTATION: ('airport', 'car_rental',
            'bus_station', 'train_station', 'parking', 'subway_station', 'gas_station',
            'transit_station'),
        values.Category.SHOPPING: ('book_store', 'clothing_store', 'department_store',
            'furniture_store', 'home_goods_store', 'jewelry_store', 'shoe_store',
            'shopping_mall', 'store'),
        values.Category.ENTERTAINMENT: ('stadium', 'casino', 'movie_theater'),
        values.Category.REGION: ('administrative_area_level_1', 'administrative_area_level_2',
            'administrative_area_level_3', 'administrative_area_level_4',
            'administrative_area_level_5', 'colloquial_area',
            'country', 'locality', 'natural_feature', 'neighborhood',
            'political', 'postal_code', 'postal_code_prefix', 'postal_town'),
    }

    @staticmethod
    def types_to_category(places_api_types):
        types = set(places_api_types or ())
        for category, types_for_category in PlaceDetails.CATEGORY_TO_GOOGLE_TYPES.iteritems():
            for t in types_for_category:
                if t in types:
                    return category
        return values.Category.ATTRACTIONS

    SUB_CATEGORY_TO_GOOGLE_TYPES = {
        values.SubCategory.BAR: ('bar',),
        values.SubCategory.RESTAURANT: ('restaurant', 'cafe'),
        values.SubCategory.NIGHTCLUB: ('night_club',),
        values.SubCategory.BAKERY: ('bakery',),
        values.SubCategory.MUSEUM: ('museum',),
        values.SubCategory.SPORTS: ('stadium',),
        values.SubCategory.THEATER: ('movie_theater',),
        values.SubCategory.CITY: ('locality',),
        values.SubCategory.NEIGHBORHOOD: ('neighborhood',),
        values.SubCategory.AIRPORT: ('airport',),
        values.SubCategory.TRAIN_STATION: ('train_station', 'transit_station', 'subway_station'),
        values.SubCategory.BUS_STATION: ('bus_station',),
        values.SubCategory.CAR_RENTAL: ('car_rental',),
    }

    @staticmethod
    def types_to_sub_category(places_api_types):
        types = set(places_api_types or ())
        for sub_category, types_for_sub_category in PlaceDetails.SUB_CATEGORY_TO_GOOGLE_TYPES.iteritems():
            for t in types_for_sub_category:
                if t in types:
                    return sub_category
        return None

    @staticmethod
    def parse_opening_hours(hours_json):
        if not hours_json:
            return None
        tohour = lambda p: int(str(p['time'])[:2])
        tominute = lambda p: int(str(p['time'])[2:])
        periods = []
        for period_json in hours_json.get('periods', ()):
            open_ = period_json['open']
            close_ = period_json['close']
            period = data.OpeningPeriod(
                open_['day'], tohour(open_), tominute(open_),
                close_ and close_['day'], close_ and tohour(close_), close_ and tominute(close_))
            periods.append(period)
        hours = data.OpeningHours(opening_periods=periods)
        hours.source_text = hours.as_string
        return hours

