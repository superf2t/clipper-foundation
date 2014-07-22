import datetime
import fileinput
import time
import traceback

import data
from database import user
import serviceimpls

GUIDE_USER = 'travel@unicyclelabs.com'
SLEEP_TIME_SECS = 2

def main(infile):
    db_user = user.User.get_by_email(GUIDE_USER)
    assert db_user
    session_info = data.SessionInfo(db_user=db_user)
    service = serviceimpls.AdminService(session_info)
    logfile = lf = open('bulk_guide_creator_%s.log' % \
        datetime.datetime.now().strftime('%Y%m%d-%H-%M-%S'), 'w')
    for line in infile:
        url = line.strip()
        logprint(lf, 'Beginning parsing on %s' % url)
        req = serviceimpls.ParseTripPlanRequest(url=url)
        try:
            resp = service.parsetripplan(req)
        except Exception as e:
            logprint(lf, 'Error: %s\n%s\n-----' % (url, traceback.format_exc()))
            continue
        logprint(lf, 'Completed parsing (%d): "%s"' % (
            resp.trip_plan.trip_plan_id, resp.trip_plan.name))
        logprint(lf, '-----')
        time.sleep(SLEEP_TIME_SECS)
    logfile.close()

def log(f, line):
    f.write(line + '\n')

def logprint(f, line):
    print line
    log(f, line)

if __name__ == '__main__':
    main(fileinput.input())
