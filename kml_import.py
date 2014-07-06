import urllib2
import urlparse

from lxml import etree

import data
import geocode
import google_places
from scraping.html_parsing import tostring
from scraping.html_parsing import tostring_with_breaks
import utils

def parse_from_kml_url(kml_url):
    kml = get_kml(kml_url)
    parser = KmlParser(kml)
    return parser.parse()

def get_kml_from_map_url(map_url):
    kml_url = get_kml_url(map_url)
    if kml_url:
        return get_kml(kml_url)
    return None

def get_kml(kml_url):
    resp = urllib2.urlopen(kml_url)
    return etree.parse(resp, etree.XMLParser())

def get_kml_url(map_url):
    parsed = urlparse.urlparse(map_url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()
    params = urlparse.parse_qs(parsed.query)
    if (host in ('www.google.com', 'maps.google.com') and 'output=kml' in map_url.lower()
        or host == 'mapsengine.google.com' and path.endswith('/kml')):
        return map_url
    if params.get('msid'):
        msid = params.get('msid')[0]
        return 'https://www.google.com/maps/ms?msa=0&output=kml&msid=%s' % msid
    if params.get('mid'):
        mid = params.get('mid')[0]
        return 'https://mapsengine.google.com/map/u/0/kml?mid=%s' % mid
    return None

class KmlParser(object):
    def __init__(self, tree):
        self.root = tree.getroot()
        self.nsmap = {'ns': self.root.nsmap.get(None)}

    def parse(self):
        raw_entities = []
        for placemark in self.xpath(self.root, './/ns:Placemark'):
            raw_entities.append(self.placemark_to_entity(placemark))
        entities = utils.parallelize(self.augment_entity, [(e,) for e in raw_entities])
        name = tostring(self.xpath(self.root, 'ns:Document/ns:name')[0])
        # TODO: Parse the latlngs into a Bounds object for the trip plan.
        # Right now this is happening the javascript as a hack.
        return data.TripPlan(name=name, entities=entities)

    def placemark_to_entity(self, placemark_elem):
        pm = placemark_elem
        name_elem = self.xpath(pm, 'ns:name')
        name = tostring(name_elem[0]) if name_elem is not None else None
        description_elem = self.xpath(pm, 'ns:description')
        description_html = tostring(description_elem[0]) if description_elem else None
        description = self.html_str_to_text(description_html) if description_html else None
        latlng = self.parse_latlng(self.xpath(pm, 'ns:Point'))
        return data.Entity(name=name, description=description, latlng=latlng)

    def parse_latlng(self, point_elem):
        if point_elem is None:
            return
        coords = self.xpath(point_elem[0], 'ns:coordinates')[0]
        lng, lat = map(float, coords.text.split(',')[:2])
        return data.LatLng(lat, lng)

    def augment_entity(self, entity):
        search_result = geocode.lookup_place(entity.name, latlng_dict=entity.latlng.to_json_obj())
        if search_result:
            place_result = google_places.lookup_place_by_reference(search_result.get_reference())
            google_place_entity = place_result.to_entity()
            google_place_entity.update(entity)
            return google_place_entity
        else:
            return entity.copy()

    def xpath(self, elem, xpath):
        return elem.xpath(xpath, namespaces=self.nsmap)

    def html_str_to_text(self, html_str):
        return tostring_with_breaks(etree.HTML(html_str), with_tail=True, strip_punctuation=False)

if __name__ == '__main__':
    for url in (
        'https://www.google.com/maps/ms?msid=212975947534437773581.0004dd59088a458cee522&msa=0',
        'https://mapsengine.google.com/map/u/0/edit?mid=z5iif9BRDuYk.k3RLIiiCcxqg&authuser=0&hl=en',
        'https://www.google.com/maps/ms?msa=0&output=kml&msid=212975947534437773581.0004dd59088a458cee522',
        'https://mapsengine.google.com/map/u/0/kml?mid=z5iif9BRDuYk.k3RLIiiCcxqg'):
        print get_kml_url(url)
        print get_kml(url).read()
