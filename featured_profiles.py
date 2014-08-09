import csv
from collections import defaultdict
import operator
import string

import constants

class ProfileConfig(object):
    def __init__(self, host, display_name, icon_url, trip_plan_ids):
        self.host = host
        self.display_name = display_name
        self.icon_url = icon_url
        self.trip_plan_ids = trip_plan_ids or []

    @property
    def profile_name_token(self):
        return profile_name_token(self.host)

def profile_name_token(host):
    display_name = constants.SOURCE_HOST_TO_DISPLAY_NAME.get(host)
    if not display_name:
        return None
    return display_name.lower().replace('&', 'and').translate(None, string.punctuation).replace(' ', '').strip()

def parse_configs():
    trip_plan_ids_by_source_host = defaultdict(list)
    for row in csv.reader(open(constants.FEATURED_PROFILES_CONFIG_FILE)):
        if not row:
            continue
        try:
            source_host = row[0]
            trip_plan_id = int(row[1])
        except ValueError:
            continue
        trip_plan_ids_by_source_host[source_host].append(trip_plan_id)
    configs = []
    for source_host, trip_plan_ids in trip_plan_ids_by_source_host.iteritems():
        display_name = constants.SOURCE_HOST_TO_DISPLAY_NAME.get(source_host)
        icon_url = constants.SOURCE_HOST_TO_ICON_URL.get(source_host)
        config = ProfileConfig(source_host, display_name, icon_url, trip_plan_ids)
        configs.append(config)
    return sorted(configs, key=operator.attrgetter('display_name'))

PROFILE_CONFIGS = parse_configs()
PROFILE_CONFIGS_BY_NAME_TOKEN = dict((c.profile_name_token, c) for c in PROFILE_CONFIGS)
