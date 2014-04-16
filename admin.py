import os

import constants
import data

def load_all_trip_plans(include_deleted=True):
    data_dir = os.path.join(constants.PROJECTPATH, 'local_data')
    trip_plans = []
    for fname in os.listdir(data_dir):
        full_fname = os.path.join(constants.PROJECTPATH, 'local_data', fname)
        trip_plan = data.load_trip_plan_from_filename(full_fname, include_deleted=include_deleted)
        trip_plans.append(trip_plan)
    return trip_plans
