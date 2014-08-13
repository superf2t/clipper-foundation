from optparse import OptionParser

import guide_config
from tools import grab_trip_plan
import utils

def main(host):
    trip_plan_ids = utils.flatten(config.trip_plan_ids for config in guide_config.GUIDES)
    grab_trip_plan.main(host, trip_plan_ids)

if __name__ == '__main__':
    parser = OptionParser(usage='''usage: %prog [options]

Copies the trip plans from the featured cities config from the given host to the
storage on the machine running this script.''')
    parser.add_option('--host', dest='host', help='Host to pull from, default: travelclipper.unicyclelabs.com',
        default='travelclipper.unicyclelabs.com')
    options, args = parser.parse_args()
    main(options.host)
