import cStringIO
from collections import defaultdict
import csv
import urlparse

import constants
import data
from database import user

GUIDE_USER = 'travel@unicyclelabs.com'

def main():
    db_user = user.User.get_by_email(GUIDE_USER)
    all_trip_plans_for_user = data.load_all_trip_plans_for_creator(db_user.id)

    outfile = cStringIO.StringIO()
    writer = csv.writer(outfile)
    writer.writerow([
        'name',
        'location_name',
        'source host',
        'source_url',
        'trip plan url',
        'admin url',

        'missing_location_name',
        'missing_location_latlng',

        'num_missing_name',
        'num_missing_photos',
        'num_missing_location',
        'num_missing_category',
        'num_missing_description',
        ])


    for trip_plan in all_trip_plans_for_user:
        if not trip_plan.source_url:
            continue
        source_host = urlparse.urlparse(trip_plan.source_url).netloc.lower()

        num_missing_name = 0
        num_missing_photos = 0
        num_missing_location = 0
        num_missing_category = 0
        num_missing_description = 0
        for e in trip_plan.entities:
            if not e.name:
                num_missing_name += 1
            if not e.photo_urls:
                num_missing_photos += 1
            if not e.latlng:
                num_missing_location += 1
            if not e.category or not e.category.category_id:
                num_missing_category += 1
            if not e.description:
                num_missing_description += 1

        writer.writerow([
            trip_plan.name.encode('utf-8') if trip_plan.name else None,
            trip_plan.location_name.encode('utf-8') if trip_plan.location_name else None,
            source_host,
            trip_plan.source_url.encode('utf-8') if trip_plan.source_url else None,
            '%s/trip_plan/%s' % (constants.BASE_URL, trip_plan.trip_plan_id),
            '%s/admin/editor/%s' % (constants.BASE_URL, trip_plan.trip_plan_id),
            len(trip_plan.entities),
            0 if trip_plan.location_name else 1,
            0 if trip_plan.location_latlng else 1,
            num_missing_name,
            num_missing_photos,
            num_missing_location,
            num_missing_category,
            num_missing_description,
            ])

    print outfile.getvalue()
    outfile.close()

if __name__ == '__main__':
    main()
