import os

import constants
import data

SORTINGS = {
    'name': lambda t1, t2: cmp(t1.name, t2.name),
    'creator': lambda t1, t2: cmp(t1.creator, t2.creator),
    'entity_count': lambda t1, t2: cmp(len(t1.entities), len(t2.entities)),
    'last_modified': lambda t1, t2: cmp(t1.last_modified_datetime(), t2.last_modified_datetime()),
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
    return trip_plans
