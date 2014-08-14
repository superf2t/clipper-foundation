from optparse import OptionParser
import urllib2

import data
import serviceimpls

def main(host, trip_plan_ids):
    request = serviceimpls.TripPlanGetRequest(trip_plan_ids=trip_plan_ids, include_entities=True)
    url = 'https://%s/tripplanservice/get' % host
    url_request = urllib2.Request(url, request.to_json_str(), {'Content-Type': 'application/json'})
    url_response = urllib2.urlopen(url_request)
    response = serviceimpls.TripPlanGetResponse.from_json_str(url_response.read())
    for trip_plan in response.trip_plans:
        data.save_trip_plan(trip_plan)
        print 'Saved trip plan as %s' % trip_plan.trip_plan_url()

if __name__ == '__main__':
    parser = OptionParser(usage='''usage: %prog [options] trip_plan_id1 trip_plan_id2 ...

Copies the trip plans with the given ids from the given host to the
storage on the machine running this script.''')
    parser.add_option('--host', dest='host', help='Host to pull from, default: www.wherefare.co',
        default='www.wherefare.co')
    options, args = parser.parse_args()
    main(options.host, map(int, args))
