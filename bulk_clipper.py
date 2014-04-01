import csv
import fileinput

import clip_logic
import data
import yelp

def import_from_jlg_restaurant_csv(username, city, trip_plan_name, infile):
    reader = csv.reader(infile)
    trip_plan = data.TripPlan(data.generate_trip_plan_id(), trip_plan_name, creator=username)
    reader.next()  # Header row
    for row in reader:
        if not row:
            continue
        name = row[0]
        if not name:
            continue
        notes = row[1]
        verdict = row[3]
        description = '%s\n\n%s' % (notes, verdict)
        description = description.strip()
        yelp_response = yelp.search_by_term(name, city)
        if not yelp_response or not yelp_response.first_result():
            print 'No results for %s in %s' % (name, city)
            continue
        result = yelp_response.first_result()
        clip_result = clip_logic.scrape_and_build_entity(result['url'], trip_plan)
        if clip_result.entity:
            clip_result.entity.description = description
        print '%s clip status: %s' % (name, clip_result.status)
    data.save_trip_plan(trip_plan)
    return trip_plan


if __name__ == '__main__':
    trip_plan = import_from_jlg_restaurant_csv('jonathan@unicyclelabs.com', 'San Francisco, CA',
        'San Francisco Restaurants and Bars', fileinput.input())
    print 'Done creating trip plan id: %s' % trip_plan.trip_plan_id
