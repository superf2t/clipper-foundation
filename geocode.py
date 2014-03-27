import json
import urllib
import urllib2

API_KEY = 'AIzaSyDzW3qolS2BMtVZq1DmrUnsYGDZQ2VUw2k'

def lookup_latlng(address):
    url = 'http://maps.googleapis.com/maps/api/geocode/json?address=%s&sensor=false' % urllib.quote(address.encode('utf-8'))
    response = urllib2.urlopen(url).read()
    data = json.loads(response)
    try:
        return GeocodeResult(data['results'][0])
    except:
        return None

def lookup_place(query):
    url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?sensor=false&key=%s&query=%s' % (
        API_KEY, urllib.quote(query.encode('utf-8')))
    response = urllib2.urlopen(url).read()
    data = json.loads(response)
    try:
        return LocationResult(data['results'][0])
    except:
        return None


class LocationResult(object):
    def __init__(self, raw_result):
        self.raw_result = raw_result

    def latlng_json(self):
        return self.raw_result['geometry']['location']

    def is_precise(self):
        raise UnsupportedOperationException()

    def __str__(self):
        return json.dumps(self.raw_result, sort_keys=True, indent=4, separators=(',', ': '))

class GeocodeResult(LocationResult):
    def __init__(self, raw_result):
        super(GeocodeResult, self).__init__(raw_result)

    def is_precise(self):
        return self.raw_result['geometry']['location_type'] in ('ROOFTOP', 'RANGE_INTERPOLATED')

class PlaceResult(LocationResult):
    def __init__(self, raw_result):
        super(LocationResult, self).__init__(raw_result)

    def is_precise(self):
        return True

