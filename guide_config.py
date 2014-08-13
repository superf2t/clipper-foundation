import json
import operator

import constants
import geometry
import serializable

class GuideConfig(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(
        'city_name', 'latlng', serializable.listf('trip_plan_ids'))

    def __init__(self, city_name=None, latlng=None, trip_plan_ids=None):
        self.city_name = city_name
        self.latlng = latlng
        self.trip_plan_ids = trip_plan_ids

    @property
    def city_name_url_token(self):
        return self.city_name.lower().replace(' ', '-')

    @property
    def num_guides(self):
        return len(self.trip_plan_ids)

def find_nearby_city_configs(latlng):
    city_configs = []
    for city_config in GUIDES_BY_CITY.itervalues():
        distance = geometry.earth_distance_meters(
            city_config.latlng['lat'], city_config.latlng['lng'],
            latlng.lat, latlng.lng)
        if distance < 40000:
            city_configs.append(city_config)
    return city_configs

def find_most_prominent_nearby_city_config(latlng):
    city_configs = find_nearby_city_configs(latlng)
    best_config = None
    for config in city_configs:
        if not best_config or config.num_guides > best_config.num_guides:
            best_config = config
    return best_config

def load_guide_configs():
    configs = []
    for obj in json.load(open(constants.FEATURED_CITIES_CONFIG_FILE)):
        configs.append(GuideConfig.from_json_obj(obj))
    return sorted(configs, key=operator.attrgetter('city_name'))

GUIDES = load_guide_configs()
GUIDES_BY_CITY = dict((config.city_name, config) for config in GUIDES)
GUIDES_BY_CITY_URL_TOKEN = dict((config.city_name_url_token, config) for config in GUIDES)
