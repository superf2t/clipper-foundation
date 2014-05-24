import urllib

import serializable

class SampleSite(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('host', 'display_name',
        'icon_url', 'search_url_template', 'prompt_text')

    def __init__(self, host, display_name, icon_url, search_url_template, prompt_text):
        self.host = host
        self.display_name = display_name
        self.icon_url = icon_url
        self.search_url_template = search_url_template
        self.prompt_text = prompt_text

    def format_search_url(self, location_name, location_latlng, query=None):
        return self.search_url_template % {
            'location': urllib.quote_plus(location_name) if location_name else None,
            'lat': location_latlng.lat if location_latlng else None,
            'lng': location_latlng.lng if location_latlng else None,
            'query': urllib.quote_plus(query) if query else None,
        }

SAMPLE_SITES = map(lambda vals: SampleSite(*vals), (
    ('www.yelp.com', 'Yelp', 'http://www.yelp.com/favicon.ico',
        'http://www.yelp.com/search?find_loc=%(location)s&find_desc=restaurants', 'Top restaurants from Yelp'),
    ('www.tripadvisor.com', 'TripAdvisor', 'http://www.tripadvisor.com/favicon.ico',
        'http://www.tripadvisor.com/Search?q=%(location)s', 'Top attractions from TripAdvisor'),
    #('www.hotels.com', 'Hotels.com', 'http://www.hotels.com/favicon.ico',
        #'http://www.hotels.com/search.do?query=%(query)s+%(location)s'),
    ('www.hotels.com', 'Hotels.com', 'http://www.hotels.com/favicon.ico',
        'http://www.hotels.com/search.do?resolvedLocation=GEO_LOCATION%%3A%(location)s%%7C%(lat).6f%%7C%(lng).6f%%3AGEOCODE%%3ALOW',
        'Top hotels from Hotels.com'),
    ('www.airnbnb.com', 'Airbnb', 'https://www.airbnb.com/favicon.ico',
        'https://www.airbnb.com/s/%(location)s', 'Top rentals from Airbnb')
    ))

def find_site_by_host(host):
    for site in SAMPLE_SITES:
        if site.host == host:
            return site
    return None
