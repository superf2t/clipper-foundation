import json
import urllib
import urllib2

import oauth2

import constants

def get_business_by_id(business_id):
    url = 'http://api.yelp.com/v2/business/%s' % business_id
    signed_url = sign_url(url)
    return make_request(signed_url)

def search_by_term(query, location):
    url = 'http://api.yelp.com/v2/search?term=%s&location=%s' % (urllib.quote(query), urllib.quote(location))
    signed_url = sign_url(url)
    return make_request(signed_url)

class YelpResponse(object):
    def __init__(self, json_response):
        self.json_response = json_response

    def first_result(self):
        businesses = self.json_response.get('businesses')
        return businesses and businesses[0]

def sign_url(url):
    consumer = oauth2.Consumer(constants.YELP_CONSUMER_KEY, constants.YELP_CONSUMER_SECRET)
    oauth_request = oauth2.Request('GET', url, {})
    oauth_request.update({'oauth_nonce': oauth2.generate_nonce(),
                          'oauth_timestamp': oauth2.generate_timestamp(),
                          'oauth_token': constants.YELP_TOKEN,
                          'oauth_consumer_key': constants.YELP_CONSUMER_KEY})

    token = oauth2.Token(constants.YELP_TOKEN, constants.YELP_TOKEN_SECRET)
    oauth_request.sign_request(oauth2.SignatureMethod_HMAC_SHA1(), consumer, token)
    return oauth_request.to_url()

def make_request(signed_url):
    try:
        conn = urllib2.urlopen(signed_url, None)
        try:
            response = json.loads(conn.read())
        finally:
            conn.close()
    except urllib2.HTTPError, error:
        response = json.loads(error.read())
    return YelpResponse(response)
