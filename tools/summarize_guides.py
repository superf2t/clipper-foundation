import cStringIO
from collections import defaultdict
import csv
import fileinput
import urlparse

import data
from database import user

GUIDE_USER = 'travel@unicyclelabs.com'

def load_trip_plans(mode):
    if not mode or mode == 'all':
        db_user = user.User.get_by_email(GUIDE_USER)
        return data.load_all_trip_plans_for_creator(db_user.id)
    elif mode in ('urls', 'ids'):
        trip_plan_ids = []
        for row in csv.reader(fileinput.input()):
            id_or_url = row[0]
            try:
                if mode == 'urls':
                    trip_plan_id = int(id_or_url.split('/')[-1])
                else:
                    trip_plan_id = int(id_or_url)
            except:
                continue
            trip_plan_ids.append(trip_plan_id)
        return data.load_trip_plans_by_ids(trip_plan_ids)
    return None

def main(mode):
    trip_plans = load_trip_plans(mode)
    trip_plans_by_source = defaultdict(list)
    for trip_plan in trip_plans:
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
                trip_plan.name.encode('utf-8') if trip_plan.name else None,
                trip_plan.location_name.encode('utf-8') if trip_plan.location_name else None,
                len(trip_plan.entities),
                trip_plan.source_url.encode('utf-8') if trip_plan.source_url else None])

    print outfile.getvalue()
    outfile.close()

if __name__ == '__main__':
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else 'urls'
    print mode
    main(mode)
