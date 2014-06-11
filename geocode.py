import json
import re
import string
import urllib
import urllib2

import constants

def lookup_latlng(address):
    if not address:
        return None
    url = 'https://maps.googleapis.com/maps/api/geocode/json?address=%s&sensor=false&key=%s' % (
        urllib.quote(address.encode('utf-8')), constants.GOOGLE_PLACES_API_KEY)
    response = urllib2.urlopen(url).read()
    print response
    data = json.loads(response)
    try:
        return GeocodeResult(data['results'][0])
    except:
        return None

def lookup_place(query, latlng_dict=None):
    results = search_for_places(query, latlng_dict)
    return results[0] if results else None

def search_for_places(query, latlng_dict=None, radius_meters=1000, max_results=None):
    if not query:
        return None
    url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?sensor=false&key=%s&query=%s' % (
        constants.GOOGLE_PLACES_API_KEY, urllib.quote(query.encode('utf-8')))
    if latlng_dict:
        latlng = '%(lat)s,%(lng)s' % latlng_dict
        url += '&location=%s&radius=%d' % (latlng, radius_meters)
    response = urllib2.urlopen(url).read()
    data = json.loads(response)
    raw_results = data['results']
    if not raw_results:
        return None
    if max_results:
        raw_results = raw_results[:max_results]
    return [PlaceResult(result) for result in raw_results]


class LocationResult(object):
    def __init__(self, raw_result):
        self.raw_result = raw_result

    def latlng_json(self):
        return self.raw_result['geometry']['location']

    def viewport_json(self):
        return self.raw_result['geometry'].get('viewport')

    def is_precise(self):
        raise NotImplementedError()

    def get_name(self):
        raise NotImplementedError()

    def get_normalized_name(self):
        return LocationResult.normalize_name(self.get_name())

    def is_clear_match(self, entity_name):
        return self.is_precise() and self.is_name_match(entity_name)

    def is_name_match(self, entity_name):
        name = self.get_normalized_name()
        other_name = LocationResult.normalize_name(entity_name)
        if name and other_name:
            return (name in other_name) or (other_name in name)
        return False

    def __str__(self):
        return json.dumps(self.raw_result, sort_keys=True, indent=4, separators=(',', ': '))

    STRIP_PUNCTUATION_RE = re.compile('[%s]' % re.escape(string.punctuation))
    @staticmethod
    def normalize_name(name):
        return LocationResult.STRIP_PUNCTUATION_RE.sub('', name.lower())

class GeocodeResult(LocationResult):
    def __init__(self, raw_result):
        super(GeocodeResult, self).__init__(raw_result)

    def is_precise(self):
        return self.raw_result['geometry']['location_type'] in ('ROOFTOP', 'RANGE_INTERPOLATED')

    def get_name(self):
        for component in self.raw_result['address_components']:
            types = component['types']
            if ('point_of_interest' in types) or ('establishment' in types) or ('premise' in types):
                return component['long_name']
        return ''

class PlaceResult(LocationResult):
    def __init__(self, raw_result):
        super(PlaceResult, self).__init__(raw_result)

    def is_precise(self):
        return True

    def get_name(self):
        return self.raw_result['name']

    def get_reference(self):
        return self.raw_result['reference']
