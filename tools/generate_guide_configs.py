import collections
import csv
import fileinput
import time

import geocode
import guide_config
import serializable

## Get all trip plans if you want to run locally.  Skip if running on prod
# cat <clean-guides.csv> | awk -F/ '{print $5}' | xargs python tools/grab_trip_plan.py
## Create the summary config file used for featured profiles
# cat <clean-guides.csv> | python tools/summarize_guides.py > data/guides.csv
## Build the per city guide config from the profile config
# cat data/guides.csv | python tools/generate_guide_configs.py > data/guide_configs.csv
## Manually adjust mappings from small cities to their nearby big cites:
## 2066883252869202 - Upper Manhattan --> New York
## 3426431336940565 - Hampstead --> London
## 4007950464330075 - Manhattan --> New York
## 1161797211171935 - Brooklyn --> New York

def main():
    trip_plans_by_location = collections.defaultdict(list)
    for row in csv.reader(fileinput.input()):
        try:
            trip_plan_id = int(row[1])
            location_name = unicode(row[3])
        except:
            continue
        trip_plans_by_location[location_name].append(trip_plan_id)

    guide_configs = []
    for location_name, trip_plan_ids in trip_plans_by_location.iteritems():
        latlng = geocode.lookup_latlng(location_name).latlng_json()
        guide_configs.append(guide_config.GuideConfig(location_name, latlng, trip_plan_ids))
        time.sleep(0.5)

    print serializable.to_json_str(guide_configs, pretty_print=True)

if __name__ == '__main__':
    main()
