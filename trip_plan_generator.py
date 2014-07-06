from cStringIO import StringIO
import re
import string
import urlparse

from lxml import etree
import requests

import clip_logic
import data
import google_places
import geocode
from scraping import html_parsing
import serviceimpls

def parse_tree(url):
    response = requests.get(url)
    parser = etree.HTMLParser()
    return etree.parse(StringIO(response.text.encode('utf-8')), parser)

class EntityData(object):
    def __init__(self, name=None, address=None, phone=None, website=None):
        self.name = name
        self.address = address
        self.phone = phone
        self.website = website

class GoogleBasedAutoTripPlanCreator(object):
    def __init__(self, url, creator=None, trip_plan_name=None, address_context=None,
            use_address=False):
        self.url = url
        self.root = None
        self.creator = creator
        self.trip_plan_name = trip_plan_name
        self.address_context = address_context
        self.use_address = use_address

    def getroot(self):
        if self.root is None:
            self.root = parse_tree(self.url).getroot()
        return self.root

    def get_trip_plan_name(self):
        return self.trip_plan_name

    def get_creator(self):
        if self.creator:
            return self.creator
        host = urlparse.urlparse(self.url).netloc.lower().lstrip('www.')
        return 'admin@%s' % host

    def lookup_entities(self, entity_datas):
        entities = []
        address_context = self.get_address_context()
        for entity_data in entity_datas:
            if entity_data.address and self.use_address:
                query = '%s, %s, %s' % (entity_data.name, entity_data.address, address_context)
            else:
                query = '%s, %s' % (entity_data.name, address_context)
            place_result = geocode.lookup_place(query)
            if not place_result or not place_result.get_reference():
                print 'Could not find a place for entity data: %s' % entity_data.__dict__
                continue
            place = google_places.lookup_place_by_reference(place_result.get_reference())
            entities.append(place.to_entity())
        return self.process_entities(entities)

    def process_entities(self, entities):
        references_seen = set()
        output_entities = []
        for entity in entities:
            if entity.google_reference in references_seen:
                continue
            references_seen.add(entity.google_reference)
            entity.source_url = self.url
            output_entities.append(entity)
        return output_entities

    def build_from_entity_data(self, entity_datas):
        entities = self.lookup_entities(entity_datas)
        trip_plan = create_trip_plan(self.get_trip_plan_name(), self.get_creator())
        add_entities_to_trip_plan(trip_plan.trip_plan_id, self.get_creator(), entities)
        print 'Created trip plan %d with %d entities' % (trip_plan.trip_plan_id, len(entities))

    def get_address_context(self):
        return self.address_context

    def run():
        raise NotImplementedError()

# Parsing 2014-style articles like 
# http://www.nytimes.com/2014/04/13/travel/36-hours-in-seville-spain.html
class Nytimes36hours(GoogleBasedAutoTripPlanCreator):
    NUMBERED_LINE_RE = re.compile('^\d+\..*')

    def run(self):
        entity_datas = []
        for p in self.getroot().findall('.//footer//div[@class="story-info"]//p'):
            line_text = html_parsing.tostring(p, with_tail=False)
            if self.NUMBERED_LINE_RE.match(line_text):
                for child in p.iterchildren():
                    tag = child.tag.lower()
                    text = html_parsing.tostring(child, with_tail=False)
                    if tag == 'strong':
                        if self.NUMBERED_LINE_RE.match(text):
                            name = text.split('.')[1]
                        else:
                            name = text
                        current_entity = EntityData(name=name.strip().strip(string.punctuation))
                        entity_datas.append(current_entity)
                    elif tag == 'a':
                        current_entity.website = child.get('href')
                    tail = child.tail.strip().strip(string.punctuation) if child.tail else ''
                    if tail:
                        parts = tail.split(';')
                        current_entity.address = parts[0].strip()
                        if len(parts) >= 2:
                            current_entity.phone = parts[1].strip()
        self.build_from_entity_data(entity_datas)

    def get_address_context(self):
        return html_parsing.tostring(self.getroot().find('.//h1[@itemprop="headline"]')).split(' in ')[1].strip()

    def get_trip_plan_name(self):
        base_name = super(Nytimes36hours, self).get_trip_plan_name()
        if base_name:
            return base_name
        return html_parsing.tostring(self.getroot().find('.//h1[@itemprop="headline"]'))


class TripAdvisor3Days(object):
    def __init__(self, url, creator=None, trip_plan_name=None):
        self.url = url
        self.root = None
        self.creator = creator
        self.trip_plan_name = trip_plan_name

    def getroot(self):
        if self.root is None:
            self.root = parse_tree(self.url).getroot()
        return self.root

    def get_trip_plan_name(self):
        if self.trip_plan_name:
            return self.trip_plan_name
        return html_parsing.tostring(self.getroot().find('.//h1[@id="HEADING"]'))

    def get_creator(self):
        if self.creator:
            return self.creator
        host = urlparse.urlparse(self.url).netloc.lower().lstrip('www.')
        return 'admin@%s' % host

    def absolute_url(self, relative_url):
        return urlparse.urljoin(self.url, relative_url)

    def build_from_entities(self, entities):
        trip_plan = create_trip_plan(self.get_trip_plan_name(), self.get_creator())
        add_entities_to_trip_plan(trip_plan.trip_plan_id, self.get_creator(), entities)
        print 'Created trip plan %d with %d entities' % (trip_plan.trip_plan_id, len(entities))

    def run(self):
        links = self.getroot().findall('.//div[@class="guideItemInfo"]//a[@class="titleLink"]')
        urls_to_scrape = [self.absolute_url(link.get('href')) for link in links]
        entities = [clip_logic.scrape_entity_from_url(url) for url in urls_to_scrape]
        self.build_from_entities(entities)

def create_trip_plan(name, creator):
    session_info = data.SessionInfo(email=creator)
    trip_plan = data.TripPlan(name=name)
    add_op = serviceimpls.TripPlanOperation(serviceimpls.Operator.ADD.name, trip_plan)
    add_req = serviceimpls.TripPlanMutateRequest(operations=[add_op])
    response = serviceimpls.TripPlanService(session_info).mutate(add_req)
    return response.trip_plans[0]

def add_entities_to_trip_plan(trip_plan_id, creator, entities):
    session_info = data.SessionInfo(email=creator)
    operations = []
    for entity in entities:
        add_op = serviceimpls.EntityOperation(
            serviceimpls.Operator.ADD.name, trip_plan_id, entity=entity)
        operations.append(add_op)
    add_req = serviceimpls.EntityMutateRequest(operations=operations)
    response = serviceimpls.EntityService(session_info).mutate(add_req)
    return response.entities

USAGE = '''Usage:
  python trip_plan_generator.py <url>'''

def main(argv):
    if len(argv) < 2:
        print USAGE
        return
    url = argv[1]
    host = urlparse.urlparse(url).netloc.lower()
    if 'nytimes' in host:
        s = Nytimes36hours(url)
    elif 'tripadvisor.com' in host:
        s = TripAdvisor3Days(url)
    else:
        print 'Unrecognized url'
        print USAGE
        return
    s.run()

if __name__ == '__main__':
    import sys
    main(sys.argv)
