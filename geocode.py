import json
import urllib
import urllib2

def lookup_latlng(address):
    url = 'http://maps.googleapis.com/maps/api/geocode/json?address=%s&sensor=false' % urllib.quote(address.encode('utf-8'))
    response = urllib2.urlopen(url).read()
    data = json.loads(response)
    try:
        return data['results'][0]['geometry']['location']
    except:
        return None
