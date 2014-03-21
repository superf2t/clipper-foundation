import json
import urllib2

HOTELSDOTCOM_AUTOCOMPLETE_URL = ('''http://lookup.hotels.com/1/suggest/v1/json?'''
    '''callback=hcom.common.modules.autosuggest_srs.rp&query=%s&'''
    '''locale=en_US&autoSuggestInstance=search_destination&boostConfig=config-boost-2''')

def find_hotelsdotcom_url(hotel_name):
    hotel_name = hotel_name.lower().strip().replace(',', '')
    if hotel_name.endswith('hotel'):
        hotel_name = hotel_name[:-5].strip()
    query_url = HOTELSDOTCOM_AUTOCOMPLETE_URL % hotel_name.replace(' ', '+')
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

if __name__ == '__main__':
    print find_hotelsdotcom_url('Mandarin Oriental, Kuala Lumpur Hotel')
    print find_hotelsdotcom_url('westin st francis san francisco')
