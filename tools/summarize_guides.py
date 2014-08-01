import cStringIO
from collections import defaultdict
import csv
import urlparse

import data
from database import user

GUIDE_USER = 'travel@unicyclelabs.com'

def main():
    db_user = user.User.get_by_email(GUIDE_USER)
    all_trip_plans_for_user = data.load_all_trip_plans_for_creator(db_user.id)
    trip_plans_by_source = defaultdict(list)
    for trip_plan in all_trip_plans_for_user:
        if not trip_plan.source_url:
            continue
        host = urlparse.urlparse(trip_plan.source_url).netloc.lower()
        trip_plans_by_source[host].append(trip_plan)

    outfile = cStringIO.StringIO()
    writer = csv.writer(outfile)
    writer.writerow([
        'source host',
        'trip_plan_id',
        'name',
        'location_name',
        'num places',
        'source_url'])

    for host, trip_plans in trip_plans_by_source.iteritems():
        for trip_plan in trip_plans:
            writer.writerow([
                host,
                trip_plan.trip_plan_id,
                trip_plan.name.encode('utf-8'),
                trip_plan.location_name,
                len(trip_plan.entities),
                trip_plan.source_url])

    print outfile.getvalue()
    outfile.close()

if __name__ == '__main__':
    main()
