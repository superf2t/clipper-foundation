import ctypes
import datetime
import operator
import re

from dateutil import parser as date_parser
from dateutil import relativedelta
from dateutil import tz

import data
import request_logging

TRIP_PLAN_ID_RE = re.compile('/guide/(\d+)')

PACIFIC_TIME = tz.gettz('America/Los Angeles')

class SessionPageview(object):
    def __init__(self, request=None, interactions=None, duration=None, trip_plan=None):
        self.request = request
        self.interactions = interactions or []
        self.trip_plan = trip_plan
        self.duration = duration

    def first_event_timestamp(self):
        return self.request.timestamp

    def last_event_timestamp(self):
        return self.interactions[-1].interaction.timestamp if self.interactions else self.request.timestamp

    def formatted_timestamp(self):
        return format_timestamp(self.request.timestamp)

    def formatted_duration(self):
        return format_duration(self.duration)

class SessionInteraction(object):
    def __init__(self, interaction=None, duration=None):
        self.interaction = interaction
        self.duration = duration

    def formatted_timestamp(self):
        return format_timestamp(self.interaction.timestamp)

class Session(object):
    def __init__(self, pageviews=None):
        self.pageviews = pageviews or []

    @property
    def duration(self):
        return self.pageviews[-1].last_event_timestamp() - self.pageviews[0].first_event_timestamp()

    def formatted_duration(self):
        return format_duration(self.duration)

    def num_interactions(self):
        return sum(map(lambda pageview: len(pageview.interactions), self.pageviews))

def format_timestamp(timestamp):
    return timestamp.astimezone(PACIFIC_TIME).strftime('%X')

def format_duration(duration):
    total_seconds = duration.total_seconds()
    minutes = int(total_seconds / 60)
    seconds = int(total_seconds % 60)
    if minutes:
        return '%d mins %d secs' % (minutes, seconds)
    else:
        return '%d secs' % (seconds)

def load_requests(visitor_id, start_date, end_date):
    cls = request_logging.FrontendRequestLogRecord
    return cls.query \
        .filter_by(visitor_id=visitor_id) \
        .filter(cls.timestamp >= start_date).filter(cls.timestamp < end_date) \
        .filter(~cls.url.like('/static/?%')) \
        .filter(~cls.url.like('/event?%')) \
        .filter(~cls.url.like('/%service/%')) \
        .order_by(cls.timestamp) \
        .all()

def load_interactions(visitor_id, start_date, end_date):
    cls = request_logging.FrontendInteractionLogRecord
    return cls.query \
        .filter_by(visitor_id=visitor_id) \
        .filter(cls.timestamp >= start_date).filter(cls.timestamp < end_date) \
        .order_by(cls.timestamp) \
        .all()

def expand_session(visitor_id, date_str=None):
    visitor_id = ctypes.c_long(int(visitor_id)).value
    if date_str:
        date = date_parser.parse(date_str)
    else:
        date = datetime.date.today()
    next_day = date + relativedelta.relativedelta(days=1)

    request_records = load_requests(visitor_id, date, next_day)
    interaction_records = load_interactions(visitor_id, date, next_day)

    sorted_events = sorted(request_records + interaction_records, key=operator.attrgetter('timestamp'))

    trip_plan_ids = set()
    for record in request_records:
        if record.url.startswith('/guide/'):
            match = TRIP_PLAN_ID_RE.match(record.url)
            if match:
                trip_plan_ids.add(int(match.group(1)))
    trip_plan_loader = data.TripPlanLoader().load(trip_plan_ids)

    pageviews = []
    current_pageview = None
    for event in sorted_events:
        if isinstance(event, request_logging.FrontendRequestLogRecord):
            current_pageview = SessionPageview(event)
            pageviews.append(current_pageview)
            if event.url.startswith('/guide/'):
                match = TRIP_PLAN_ID_RE.match(event.url)
                if match:
                    current_pageview.trip_plan = trip_plan_loader.get(int(match.group(1)))
        elif current_pageview:
            current_pageview.interactions.append(SessionInteraction(event))

    for i, pageview in enumerate(pageviews):
        if i < len(pageviews) - 1:
            pageview.duration = pageviews[i+1].first_event_timestamp() - pageview.first_event_timestamp()
        else:
            pageview.duration = pageview.last_event_timestamp() - pageview.first_event_timestamp()
        for j, interaction in enumerate(pageview.interactions):
            if j < len(pageview.interactions) - 1:
                interaction.duration = pageview.interactions[j+1].interaction.timestamp - interaction.interaction.timestamp
            elif i < len(pageviews) - 1:
                interaction.duration = pageviews[i+1].first_event_timestamp() - interaction.interaction.timestamp
            else:
                interaction.duration = datetime.timedelta(0)

    return Session(pageviews)

if __name__ == '__main__':
    import sys
    session = expand_session(int(sys.argv[1]), '2014-08-15')
    print 'Duration: %s' % session.formatted_duration()
    for pageview in session.pageviews:
        if pageview.trip_plan:
            format = '%(url)s (%(trip_plan_name)s)\t\t\t\t%(time)s'
        else:
            format = '%(url)s\t\t\t\t%(time)s'
        print format % {
            'url': pageview.request.url,
            'time': format_timestamp(pageview.request.timestamp),
            'trip_plan_name': pageview.trip_plan.name if pageview.trip_plan else None,
            }
        for session_interaction in pageview.interactions:
            interaction = session_interaction.interaction
            print '\t%s, %s, %s\t\t\t\t%s' % (interaction.event_name, interaction.event_location,
                interaction.event_value, format_timestamp(interaction.timestamp))
