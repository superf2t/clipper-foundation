import json

import data
import guide_config

def main():
    result = {}
    for config in guide_config.GUIDES:
        result[config.city_name_url_token] = guide_data = []
        for trip_plan in data.load_trip_plans_by_ids(config.trip_plan_ids):
            guide_data.append({
                'name': trip_plan.name,
                'cover_image_url': trip_plan.cover_image_url,
                'source_url': trip_plan.source_url,
                'description': trip_plan.description,
                'num_entities': len(trip_plan.entities or []),
                'content_date': trip_plan.content_date,
                })
    print json.dumps(result, sort_keys=True, indent=4, separators=(',', ': '))

if __name__ == '__main__':
    main()
