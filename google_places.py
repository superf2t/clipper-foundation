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
            category=PlaceDetails.types_to_category(js['types']),
            sub_category=PlaceDetails.types_to_sub_category(js['types']),
            address=js['formatted_address'],
            latlng=data.LatLng(lat=location['lat'], lng=location['lng']),
            address_precision='Precise',  # TODO
            rating=js.get('rating'),
            source_url=js.get('url'),
            photo_urls=PlaceDetails.make_photo_urls(js.get('photos', ())),
            google_reference=js['reference']
            )

    @staticmethod
    def make_photo_urls(photo_objs):
        return utils.parallelize(resolve_photo_url,
            [(obj['photo_reference'], obj['width'], obj['height']) for obj in photo_objs])

    @staticmethod
    def types_to_category(places_api_types):
        types = dict((t, True) for t in places_api_types)
        if 'bar' in types or 'restaurant' in types or 'cafe' in types or 'food' in types:
            return values.Category.FOOD_AND_DRINK
        elif 'lodging' in types:
            return values.Category.LODGING
        else:
            return values.Category.ATTRACTIONS

    @staticmethod
    def types_to_sub_category(places_api_types):
        types = dict((t, True) for t in places_api_types)
        if 'bar' in types:
            return values.SubCategory.BAR
        elif 'restaurant' in types or 'cafe' in types or 'food' in types:
            return values.SubCategory.RESTAURANT
        elif 'lodging' in types:
            return values.SubCategory.HOTEL
        else:
            return None
