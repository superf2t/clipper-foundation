class TripPlanDb(object):
    def __init__(self):
        self.trip_plans_by_id = {}

    def get_by_id(self, trip_plan_id):
        return self.trip_plans_by_id.get(trip_plan_id)

    def save_trip_plan(self, trip_plan):
        self.trip_plans_by_id[trip_plan.trip_plan_id] = trip_plan

_trip_plan_db = TripPlanDb()

def load_trip_plan_by_id(trip_plan_id):
    return _trip_plan_db.get_by_id(trip_plan_id)

def load_trip_plans_by_ids(trip_plan_ids):
    return [load_trip_plan_by_id(id) for id in trip_plan_ids]

def save_trip_plan(trip_plan):
    _trip_plan_db.save_trip_plan(trip_plan)

_id_counter = 0

def generate_id():
    global _id_counter
    _id_counter += 1
    return _id_counter

def generate_entity_id():
    return generate_id()

def generate_note_id():
    return generate_id()

def generate_trip_plan_id():
    return generate_id()

def generate_comment_id():
    return generate_id()
