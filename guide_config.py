class GuideConfig(object):
    def __init__(self, city_name, latlng_tuple, trip_plan_ids):
        self.city_name = city_name
        self.latlng = {
            'lat': latlng_tuple[0],
            'lng': latlng_tuple[1],
        }
        self.trip_plan_ids = trip_plan_ids

    @property
    def city_name_url_token(self):
        return self.city_name.lower().replace(' ', '-')

def make_guide_configs(*args_list):
    return tuple(GuideConfig(*args) for args in args_list)

GUIDES = make_guide_configs(
    ('London', (51.5073509, -0.1277583), ()),
    ('Paris', (48.856614, 2.3522219), ()),
    ('New York City', (40.7127837, -74.0059413), ()),
    ('Bangkok', (13.7278956, 100.5241235), ()),
    ('Barcelona', (41.3850639, 2.1734035), ()),
    ('Rome', (41.8723889, 12.4801802), ()),
    )

GUIDES_BY_CITY = dict((config.city_name, config) for config in GUIDES)
GUIDES_BY_CITY_URL_TOKEN = dict((config.city_name_url_token, config) for config in GUIDES)
