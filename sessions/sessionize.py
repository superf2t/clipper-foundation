import datetime
import re

from dateutil import parser as date_parser
from dateutil import relativedelta
from dateutil import tz

import data
import request_logging

class SessionEvent(object):
    def __init__(self, request=None, interaction=None, trip_plan=None):
        self.request = request
        self.interaction = interaction
        self.trip_plan = trip_plan

TRIP_PLAN_ID_RE = re.compile('/guide/(\d+)')

PACIFIC_TIME = tz.gettz('America/Los Angeles')

def expand_session(visitor_id, date_str=None):
    if date_str:
        date = date_parser.parse(date_str)
    else:
        date = datetime.date.today()
    next_day = date + relativedelta.relativedelta(days=1)
    cls = request_logging.FrontendRequestLogRecord
    request_records = cls.query \
        .filter_by(visitor_id=visitor_id) \
        .filter(cls.timestamp >= date).filter(cls.timestamp < next_day) \
        .filter(~cls.url.like('/static/?%')) \
        .filter(~cls.url.like('/event?%')) \
        .filter(~cls.url.like('/%service/%')) \
        .order_by(cls.timestamp) \
        .all()
    trip_plan_ids = set([int(TRIP_PLAN_ID_RE.match(record.url).group(1)) for record in request_records if record.url.startswith('/guide/')])
    trip_plans = data.load_trip_plans_by_ids(trip_plan_ids)
    trip_plans_by_id = dict((t.trip_plan_id, t) for t in trip_plans)

    session_events = []
    for record in request_records:
        event = SessionEvent(request=record)
        if record.url.startswith('/guide/'):
            trip_plan_id = int(TRIP_PLAN_ID_RE.match(record.url).group(1))
            event.trip_plan = trip_plans_by_id.get(trip_plan_id)
        session_events.append(event)

    for event in session_events:
        if event.trip_plan:
            format = '%(url)s - %(time)s (%(trip_plan_name)s)'
        else:
            format = '%(url)s - %(time)s'
        print format % {
            'url': event.request.url,
            'time': event.request.timestamp.astimezone(PACIFIC_TIME).strftime('%X'),
            'trip_plan_name': event.trip_plan.name if event.trip_plan else None,
            }


if __name__ == '__main__':
    import sys
    expand_session(int(sys.argv[1]))
