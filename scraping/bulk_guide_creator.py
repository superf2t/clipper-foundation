# Sample usage with a dirty text file of urls,
# separated by tabs or newlins, possibly
# with extraneous quotes from the CSV export and empty lines:
# cat <file> | tr '\t' '\n' | sed 's/"//g' | grep '^http' | python scraping/bulk_guide_creator.py

import datetime
import fileinput
import time
import traceback

import data
from database import user
from scraping import trip_plan_creator
import serviceimpls

GUIDE_USER = 'travel@unicyclelabs.com'
# If a guide for the source url already exists for this user, skip.
SKIP_IF_GUIDE_EXISTS = True
SLEEP_TIME_SECS = 2

def main(infile):
    db_user = user.User.get_by_email(GUIDE_USER)
    assert db_user
    session_info = data.SessionInfo(db_user=db_user)
    service = serviceimpls.AdminService(session_info)
    logfile = lf = open('bulk_guide_creator_%s.log' % \
        datetime.datetime.now().strftime('%Y%m%d-%H-%M-%S'), 'w')
    all_trip_plans_for_user = data.load_all_trip_plans_for_creator(db_user.id)
    for line in infile:
        url = line.strip()

        if not trip_plan_creator.has_parser(url):
            logprint(lf, 'Unable to find parser: %s\n-----' % url)
            continue

        if SKIP_IF_GUIDE_EXISTS:
            canonical_url = trip_plan_creator.canonicalize_url(url)
            guide_exists = False
            for trip_plan in all_trip_plans_for_user:
                if trip_plan.source_url == canonical_url:
                    logprint(lf, 'Trip plan already exists (%d): %s' % (
                        trip_plan.trip_plan_id, url))
                    guide_exists = True
                    break
            if guide_exists:
                continue

        logprint(lf, 'Beginning parsing on %s' % url)
        req = serviceimpls.ParseTripPlanRequest(url=url)
        try:
            resp = service.parsetripplan(req)
        except Exception:
            logprint(lf, 'Error: %s\n%s\n-----' % (url, traceback.format_exc()))
            continue
        logprint(lf, 'Completed parsing %s (%d): "%s"' % (
            url, resp.trip_plan.trip_plan_id, resp.trip_plan.name))
        all_trip_plans_for_user.append(resp.trip_plan)
        logprint(lf, '-----')
        time.sleep(SLEEP_TIME_SECS)
    logfile.close()

def log(f, line):
    if not line:
        return
    f.write(line.encode('utf-8') + '\n')

def logprint(f, line):
    if not line:
        return
    print line.encode('utf-8')
    log(f, line)

if __name__ == '__main__':
    main(fileinput.input())
