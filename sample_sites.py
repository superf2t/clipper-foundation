import serializable

class SampleSite(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('host', 'display_name',
        'icon_url', 'search_url_template')

    def __init__(self, host, display_name, icon_url, search_url_template):
        self.host = host
        self.display_name = display_name
        self.icon_url = icon_url
        self.search_url_template = search_url_template

SAMPLE_SITES = map(lambda vals: SampleSite(*vals), (
    ('www.yelp.com', 'Yelp', 'http://www.yelp.com/favicon.ico', 'http://www.yelp.com/search?find_loc=%(location)s'),
    ('www.tripadvisor.com', 'TripAdvisor', 'http://www.tripadvisor.com/favicon.ico', 'http://www.tripadvisor.com/Search?q=%(location)s'),
    #('www.hotels.com', 'Hotels.com', 'http://www.hotels.com/favicon.ico', 'http://www.hotels.com/search.do?query=%(query)s+%(location)s'),
    ('www.hotels.com', 'Hotels.com', 'http://www.hotels.com/favicon.ico', 'http://www.hotels.com/search.do?resolvedLocation=GEO_LOCATION%%3A%(location)s%%7C%(lat).6f%%7C%(lng).6f%%3AGEOCODE%%3ALOW')
    ))

