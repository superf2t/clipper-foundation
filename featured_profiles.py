import csv
from collections import defaultdict
import string

import constants

def profile_name_token(host):
    display_name = constants.SOURCE_HOST_TO_DISPLAY_NAME.get(host)
    if not display_name:
        return None
    return display_name.lower().replace('&', 'and').translate(None, string.punctuation).replace(' ', '').strip()

def parse_config():
    trip_plan_ids_by_source = defaultdict(list)
    for row in csv.reader(open(constants.FEATURED_PROFILES_CONFIG_FILE)):
        if not row:
            continue
        try:
            source_host = row[0]
            trip_plan_id = int(row[1])
        except ValueError:
            continue
        name_token = profile_name_token(source_host)
        if name_token:
            trip_plan_ids_by_source[name_token].append(trip_plan_id)
    return trip_plan_ids_by_source

PROFILE_NAME_TO_TRIP_PLAN_IDS = parse_config()
