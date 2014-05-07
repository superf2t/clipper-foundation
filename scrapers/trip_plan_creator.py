import urlparse
import urllib2

from lxml import etree

import data
import geocode
import google_places
import scraper
from scrapers import nomadic_matt
import utils

class TripPlanCreator(object):
    def __init__(self, url, creator=None, trip_plan_name=None):
        self.url = url
        self.creator = creator
        self.trip_plan_name = trip_plan_name

    def get_creator(self):
        if self.creator:
            return self.creator
        host = urlparse.urlparse(self.url).netloc.lower().lstrip('www.')
        return 'admin@%s' % host

    def parse_full(self, url):
        trip_plan = self.parse_candidate(url)
        return augment_trip_plan(trip_plan)

    def parse_candidate(self, url):
        parser = make_article_parser(url)
        trip_plan = parser.make_raw_trip_plan()
        trip_plan.creator = self.get_creator()
        if self.trip_plan_name:
            trip_plan.trip_plan_name = self.trip_plan_name
        return trip_plan

def augment_trip_plan(raw_trip_plan):
    location_latlng = raw_trip_plan.location_latlng.to_json_obj() if raw_trip_plan.location_latlng else None
    entities = utils.parallelize(augment_entity, [(e, location_latlng) for e in raw_trip_plan.entities])
    trip_plan = raw_trip_plan.copy()
    trip_plan.entities = entities
    return trip_plan

def augment_entity(entity, latlng_dict=None):
    latlng = entity.latlng.to_json_obj() if entity.latlng else latlng_dict
    search_result = geocode.lookup_place(entity.name, latlng_dict=latlng)
    if search_result:
        place_result = google_places.lookup_place_by_reference(search_result.get_reference())
        google_place_entity = place_result.to_entity()
        google_place_entity.update(entity)
        return google_place_entity
    else:
        return entity.copy()

ALL_PARSERS = (nomadic_matt.NomadicMatt,)

def make_article_parser(url):
    for parser_class in ALL_PARSERS:
        if parser_class.can_parse(url):
            return parser_class(url, scraper.parse_tree(url))
    return None

def main(cmd, input):
    if cmd in ('full', 'candidate'):
        url = input
        creator = TripPlanCreator(url)
        if cmd == 'full':
            trip_plan = creator.parse_full(url)
        elif cmd == 'candidate':
            trip_plan = creator.parse_candidate(url)
        else:
            return
        trip_plan.trip_plan_id = data.generate_trip_plan_id()
        data.save_trip_plan(trip_plan)
        print 'Successfully created trip plan %s with id %d' % (trip_plan.name, trip_plan.trip_plan_id)
    elif cmd == 'augment':
        trip_plan_id = int(input)
        raw_trip_plan = data.load_trip_plan_by_id(trip_plan_id)
        trip_plan = augment_trip_plan(raw_trip_plan)
        data.save_trip_plan(trip_plan)
        print 'Successfully augmented trip plan %s with id %d' % (trip_plan.name, trip_plan.trip_plan_id)


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 3 or sys.argv[1] not in ('full', 'candidate', 'augment'):
        print 'Usage: %s <full|candidate|augment> <url|trip_plan_id> ' % sys.argv[0]
        sys.exit(1)

    main(sys.argv[1], sys.argv[2])
