import urllib

import crossreference
import serializable

class SampleSite(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('host', 'display_name',
        'icon_url', 'sample_queries', 'custom_queries_allowed', 'pseudo_query')

    def __init__(self, host, display_name, icon_url, search_url_template,
            sample_queries, custom_queries_allowed, pseudo_query=None,
            search_url_resolver_fn=None):
        self.host = host
        self.display_name = display_name
        self.icon_url = icon_url
        self.search_url_template = search_url_template
        self.sample_queries = sample_queries
        self.custom_queries_allowed = custom_queries_allowed
        self.pseudo_query = pseudo_query
        self.search_url_resolver_fn = search_url_resolver_fn

    def format_search_url(self, location_name, location_latlng, query=None):
        return self.search_url_template % {
            'location': urllib.quote_plus(location_name) if location_name else None,
            'lat': location_latlng.lat if location_latlng else None,
            'lng': location_latlng.lng if location_latlng else None,
            'query': urllib.quote_plus(query.encode('utf-8')) if query else None,
        }

    def resolve_search_url(self, location_name, location_latlng, query=None):
        if self.search_url_resolver_fn:
            return self.search_url_resolver_fn(location_name, location_latlng, query)
        else:
            return self.format_search_url(location_name, location_latlng, query)

def resolve_tripadvisor_search_url(location_name, latlng, query):
    query = query.lower()
    if query == 'hotels':
        return crossreference.find_tripadvisor_hotels_url(location_name)
    elif query == 'restaurants':
        return crossreference.find_tripadvisor_restaurants_url(location_name)
    elif query == 'attractions':
        return crossreference.find_tripadvisor_attractions_url(location_name)
    return None

SAMPLE_SITES = (
    SampleSite(host='www.tripadvisor.com', display_name='TripAdvisor', icon_url='http://www.tripadvisor.com/favicon.ico',
        search_url_template='http://www.tripadvisor.com/Search?q=%(location)s',
        sample_queries=('attractions', 'hotels', 'restaurants'), custom_queries_allowed=False,
        search_url_resolver_fn=resolve_tripadvisor_search_url),
    SampleSite(host='www.yelp.com', display_name='Yelp', icon_url='http://www.yelp.com/favicon.ico',
        search_url_template='http://www.yelp.com/search?find_loc=%(location)s&find_desc=%(query)s',
        sample_queries=('restaurants', 'bars'), custom_queries_allowed=True),
    SampleSite(host='www.airbnb.com', display_name='Airbnb', icon_url='https://www.airbnb.com/favicon.ico',
        search_url_template='https://www.airbnb.com/s/%(location)s',
        sample_queries=None, custom_queries_allowed=False, pseudo_query='rentals'),
    SampleSite(host='www.foursquare.com', display_name='Foursquare', icon_url='https://foursquare.com/img/touch-icon-ipad-retina.png',
        search_url_template='https://foursquare.com/explore?mode=url&near=%(location)s&q=%(query)s',
        sample_queries=('restaurants', 'attractions'), custom_queries_allowed=True),
    SampleSite(host='www.hotels.com', display_name='Hotels.com', icon_url='http://www.hotels.com/favicon.ico',
        search_url_template='http://www.hotels.com/search.do?resolvedLocation=GEO_LOCATION%%3A%(location)s%%7C%(lat).6f%%7C%(lng).6f%%3AGEOCODE%%3ALOW',
        sample_queries=None, custom_queries_allowed=False, pseudo_query='hotels'),
    )

def find_site_by_host(host):
    for site in SAMPLE_SITES:
        if site.host == host:
            return site
    return None
