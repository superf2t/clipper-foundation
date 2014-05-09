class SampleSite(object):
    def __init__(self, host, display_name, icon_url, search_url_prefix):
        self.host = host
        self.display_name = display_name
        self.icon_url = icon_url
        self.search_url_prefix = search_url_prefix

SAMPLE_SITES = map(lambda vals: SampleSite(*vals), (
    ('www.yelp.com', 'Yelp', 'http://www.yelp.com/favicon.ico', 'http://www.yelp.com/search?find_loc='),
    ('www.tripadvisor.com', 'TripAdvisor', 'http://www.tripadvisor.com/favicon.ico', 'http://www.tripadvisor.com/Search?q='),
    ('www.airbnb.com', 'Airbnb', 'http://www.airbnb.com/favicon.ico', 'https://www.airbnb.com/s/'),
    ('www.hotels.com', 'Hotels.com', 'http://www.hotels.com/favicon.ico', 'http://www.hotels.com/search.do?destination='),
    ))
