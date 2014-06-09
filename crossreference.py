import json
import urllib
import urllib2

HOTELSDOTCOM_AUTOCOMPLETE_URL = ('''http://lookup.hotels.com/1/suggest/v1/json?'''
    '''callback=hcom.common.modules.autosuggest_srs.rp&query=%s&'''
    '''locale=en_US&autoSuggestInstance=search_destination&boostConfig=config-boost-2''')

TRIPADVISOR_AUTOCOMPLETE_URL_TEMPLATE = 'http://www.tripadvisor.com/TypeAheadJson?query=%s&action=API'

def find_hotelsdotcom_url(hotel_name):
    hotel_name = hotel_name.lower().strip().replace(',', '')
    url = _hotelsdotcom_helper(hotel_name)
    if not url and hotel_name.endswith('hotel'):
        hotel_name = hotel_name[:-5].strip()
        url = _hotelsdotcom_helper(hotel_name)
    return url

def _hotelsdotcom_helper(hotel_name):
    query_url = HOTELSDOTCOM_AUTOCOMPLETE_URL % urllib.quote_plus(hotel_name)
    response = urllib2.urlopen(query_url).read()
    relevant_json = response[response.find('{'):response.rfind('}')+1]
    json_data = json.loads(relevant_json)
    for suggestion in json_data['suggestions']:
        if suggestion['group'] == 'HOTEL_GROUP':
            for entity in suggestion['entities']:
                destination_id = entity.get('destinationId')
                if destination_id:
                    return 'http://www.hotels.com/hotel/details.html?hotelId=%s' % destination_id
    return None

def find_tripadvisor_geo_id(location_name):
    url = TRIPADVISOR_AUTOCOMPLETE_URL_TEMPLATE % urllib.quote_plus(location_name)
    resp = urllib2.urlopen(url)
    resp_json = json.loads(resp.read())
    if resp_json and resp_json.get('results') and resp_json['results']:
        result = resp_json['results'][0]
        return result.get('value')
    return None

def find_tripadvisor_attractions_url(location_name):
    geo_id = find_tripadvisor_geo_id(location_name)
    if geo_id:
        return 'http://www.tripadvisor.com/Attractions-g%d.html' % geo_id
    return None

def find_tripadvisor_restaurants_url(location_name):
    geo_id = find_tripadvisor_geo_id(location_name)
    if geo_id:
        return 'http://www.tripadvisor.com/Restaurants-g%d.html' % geo_id
    return None

def find_tripadvisor_hotels_url(location_name):
    geo_id = find_tripadvisor_geo_id(location_name)
    if geo_id:
        return 'http://www.tripadvisor.com/Hotels-g%d.html' % geo_id
    return None

if __name__ == '__main__':
    url = find_hotelsdotcom_url('Mandarin Oriental, Kuala Lumpur Hotel')
    print url
    assert '128775' in url
    url = find_hotelsdotcom_url('westin st francis san francisco')
    print url
    assert '114219' in url
    url = find_hotelsdotcom_url('W San Francisco Hotel')
    print url
    assert '145299' in url

    url = find_tripadvisor_attractions_url('Chiang Mai, Mueang Chiang Mai District, Chiang Mai, Thailand')
    print url
    assert '293917' in url
    url = find_tripadvisor_attractions_url('Sydney NSW, Australia')
    print url
    assert '255060' in url
