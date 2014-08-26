import ctypes
import datetime
import os
import socket

from dateutil import tz

from app_core import db

PID = os.getpid()
SERVER_IP = socket.gethostbyname(socket.gethostname())

class FrontendRequestLogRecord(db.Model):
    __tablename__ = 'frontend_request'

    url = db.Column(db.Text)
    host = db.Column(db.String(255))
    referrer = db.Column(db.Text)
    user_agent = db.Column(db.Text)
    timestamp = db.Column(db.DateTime(timezone=True), primary_key=True)
    remote_addr = db.Column(db.String(255))
    response_code = db.Column(db.Integer)

    user_id = db.Column(db.Integer)
    visitor_id = db.Column(db.BigInteger)
    referral_source = db.Column(db.String(50))

    experiments = db.Column(db.String(255))

    server_ip = db.Column(db.String(50), primary_key=True)
    process_id = db.Column(db.Integer, primary_key=True, autoincrement=False)

class FrontendInteractionLogRecord(db.Model):
    __tablename__ = 'frontend_interaction'

    event_name = db.Column(db.String(50))
    event_location = db.Column(db.String(50))
    event_value = db.Column(db.String(255))

    user_agent = db.Column(db.Text)
    timestamp = db.Column(db.DateTime(timezone=True), primary_key=True)
    remote_addr = db.Column(db.String(255))

    user_id = db.Column(db.Integer)
    visitor_id = db.Column(db.BigInteger)
    referral_source = db.Column(db.String(50))

    experiments = db.Column(db.String(255))

    server_ip = db.Column(db.String(50), primary_key=True)
    process_id = db.Column(db.Integer, primary_key=True, autoincrement=False)

def log_request(request, response, session_info):
    timestamp = datetime.datetime.now(tz.tzutc())
    record = FrontendRequestLogRecord(
        url=request.full_path.rstrip('?'),
        host=request.host or '',
        referrer=request.referrer or '',
        user_agent=request.user_agent.string or '',
        timestamp=timestamp,
        remote_addr=request.remote_addr or '',
        response_code=response.status_code or 0,
        user_id=session_info.db_user.id if session_info and session_info.logged_in() else None,
        visitor_id=ctypes.c_long(session_info.visitor_id).value if session_info else None,
        referral_source=safe_trim(session_info.referral_source, 50) if session_info else None,
        experiments=session_info.experiments.logging_string() if session_info and session_info.experiments else None,
        server_ip=SERVER_IP,
        process_id=PID)
    db.session.add(record)
    db.session.commit()

def log_interaction(request, session_info, event_name, event_location=None, event_value=None):
    timestamp = datetime.datetime.now(tz.tzutc())
    record = FrontendInteractionLogRecord(
        event_name=safe_trim(event_name, 50),
        event_location=safe_trim(event_location, 50),
        event_value=safe_trim(event_value, 255),
        user_agent=request.user_agent.string or '',
        timestamp=timestamp,
        remote_addr=request.remote_addr or '',
        user_id=session_info.db_user.id if session_info and session_info.logged_in() else None,
        visitor_id=ctypes.c_long(session_info.visitor_id).value if session_info else None,
        referral_source=safe_trim(session_info.referral_source, 50) if session_info else None,
        experiments=session_info.experiments.logging_string() if session_info and session_info.experiments else None,
        server_ip=SERVER_IP,
        process_id=PID)
    db.session.add(record)
    db.session.commit()

def safe_trim(value, max_length):
    if not value:
        return value
    return value[:max_length]
