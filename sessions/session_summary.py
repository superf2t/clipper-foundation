import datetime

from dateutil import parser as date_parser
from dateutil import relativedelta
from dateutil import tz

from app_core import db
import request_logging

class SessionSummary(object):
    def __init__(self, visitor_id, remote_addr, num_requests):
        self.visitor_id = visitor_id
        self.remote_addr = remote_addr
        self.num_requests = num_requests

def list_sessions(date_str=None):
    if date_str:
        date = date_parser.parse(date_str)
    else:
        date = datetime.date.today()
    next_day = date + relativedelta.relativedelta(days=1)
    cls = request_logging.FrontendRequestLogRecord
    rows = db.session.query(cls.visitor_id, cls.remote_addr, db.func.count()) \
        .filter(cls.timestamp >= date).filter(cls.timestamp < next_day) \
        .filter(cls.visitor_id != None) \
        .filter(~cls.url.like('/static/?%')) \
        .filter(~cls.url.like('/event?%')) \
        .filter(~cls.url.like('/%service/%')) \
        .filter(~cls.remote_addr.in_(['70.36.237.242', '50.152.196.239', '24.5.69.206', '73.162.113.196'])) \
        .filter(~cls.remote_addr.like('173.252.%')) \
        .filter(~cls.user_agent.contains('Google_Analytics_Snippet_Validator')) \
        .filter(~cls.user_agent.contains('Google Keyword Suggestion')) \
        .filter(~cls.user_agent.contains('AdsBot-Google')) \
        .filter(~cls.user_agent.contains('facebookexternalhit')) \
        .filter(~cls.user_agent.contains('Googlebot')) \
        .filter(~cls.user_agent.contains('Yahoo! Slurp')) \
        .group_by(cls.visitor_id, cls.remote_addr) \
        .order_by(db.desc(db.func.count())) \
        .all()
    return [SessionSummary(row[0], row[1], row[2]) for row in rows]


if __name__ == '__main__':
    for summary in list_sessions():
        print '%s\t%s\t%s' % (summary.visitor_id, summary.remote_addr, summary.num_requests)
