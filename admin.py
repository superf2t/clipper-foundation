import commands
import os

import constants
import data
from database import user

SORTINGS = {
    'name': lambda t1, t2: cmp(t1.name, t2.name),
    'creator': lambda t1, t2: cmp(t1.creator_name(), t2.creator_name()),
    'entity_count': lambda t1, t2: cmp(len(t1.entities), len(t2.entities)),
    'last_modified': lambda t1, t2: t1.compare(t2),
    'location_name': lambda t1, t2: cmp(t1.location_name, t2.location_name),
    'source_url': lambda t1, t2: cmp(t1.source_url, t2.source_url),
    'status': lambda t1, t2: cmp(t1.status, t2.status),
}

def fetch_trip_plans(sorting=None, reverse=False):
    trip_plans = load_all_trip_plans()
    if not sorting or sorting not in SORTINGS:
        return trip_plans
    return sorted(trip_plans, cmp=SORTINGS[sorting], reverse=reverse)

def load_all_trip_plans(include_deleted=True):
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    trip_plans = []
    for fname in os.listdir(data_dir):
        full_fname = os.path.join(constants.PROJECTPATH, 'local_data', fname)
        trip_plan = data.load_trip_plan_from_filename(full_fname, include_deleted=include_deleted)
        trip_plans.append(trip_plan)

    resolver = user.DisplayNameResolver()
    resolver.populate([t.user.public_id for t in trip_plans if t.user and t.user.public_id])
    for t in trip_plans:
        if t.user and t.user.public_id:
            t.user.display_name = resolver.resolve(t.user.public_id)

    return trip_plans

def load_recent_trip_plans(max=20):
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    output = commands.getoutput('ls -lt %s/*' % data_dir)
    lines = output.split('\n')[:max]
    trip_plans = [data.load_trip_plan_from_filename(line.split()[-1], include_deleted=True) for line in lines]

    resolver = user.DisplayNameResolver()
    resolver.populate([t.user.public_id for t in trip_plans if t.user and t.user.public_id])
    for t in trip_plans:
        if t.user and t.user.public_id:
            t.user.display_name = resolver.resolve(t.user.public_id)

    return trip_plans
