import datetime
import struct
import time
import uuid

from dateutil import tz

import crypto

def make_visitor_token(visitor_id):
    now_timestamp_seconds = int(time.mktime(datetime.datetime.now(tz.tzutc()).timetuple()))
    token = '%d|%d' % (visitor_id, now_timestamp_seconds)
    return crypto.encrypt_with_salt(token)

def generate_visitor_id():
    visitor_bytes = uuid.uuid4().bytes[:8]
    return struct.unpack('Q', visitor_bytes)[0]

def visitor_id_from_token(visitor_token):
    if not visitor_token:
        return None
    visitor_token = visitor_token.encode('utf-8')
    try:
        decrypted = crypto.decrypt_with_salt(visitor_token)
        return int(decrypted.split('|')[0])
    except:
        return None
