import data
import scraper

class ClipResult(object):
    STATUS_ERROR = 0
    STATUS_SUCCESS_KNOWN_SOURCE = 1
    STATUS_SAVED_FOR_LATER = 2
    STATUS_ALREADY_CLIPPED_URL = 3
    STATUS_NO_TRIP_PLAN_FOUND = 4
    STATUS_UNDO_SUCCESS = 5

    def __init__(self, status, entity=None, trip_plan=None):
        self.status = status
        self.entity = entity
        self.trip_plan = trip_plan

def handle_clipping(url, trip_plan_id, session_info, offline=False):
    trip_plan = data.load_trip_plan_by_id(trip_plan_id)
    result = None
    if not trip_plan:
        raise Exception('No trip plan found with id %s' % trip_plan_id)
    if not offline and not trip_plan.editable_by(session_info):
        raise Exception('User does not have permission to clip to this trip plan')
    if trip_plan.contains_url(url):
        return ClipResult(ClipResult.STATUS_ALREADY_CLIPPED_URL,
            entity=trip_plan.entity_by_source_url(url), trip_plan=trip_plan)
    result = scrape_and_build_entity(url, trip_plan)
    data.save_trip_plan(trip_plan)
    return result

def scrape_and_build_entity(url, trip_plan):
    result = None
    scr = scraper.build_scraper(url)
    if scr.is_base_scraper():
        clipped_page = data.ClippedPage(source_url=url, title=scr.get_page_title())
        trip_plan.clipped_pages.append(clipped_page)
        result = ClipResult(ClipResult.STATUS_SAVED_FOR_LATER, trip_plan=trip_plan)
    else:
        entity = entity_from_scraper(scr, url)
        trip_plan.entities.append(entity)
        result = ClipResult(ClipResult.STATUS_SUCCESS_KNOWN_SOURCE, entity=entity, trip_plan=trip_plan)    
    return result

def entity_from_scraper(scr, url):
    address = scr.get_address()
    location = scr.lookup_location()
    latlng = data.LatLng.from_json_obj(location.latlng_json()) if location else None
    address_precision = 'Precise' if location and location.is_precise() else 'Imprecise'
    return data.Entity(name=scr.get_entity_name(),
        category=scr.get_category(), sub_category=scr.get_sub_category(),
        address=scr.get_address(), latlng=latlng, 
        address_precision=address_precision, rating=scr.get_rating(),
        primary_photo_url=scr.get_primary_photo(), photo_urls=scr.get_photos(),
        source_url=url)

def scrape_entity_from_url(url):
    scr = scraper.build_scraper(url)
    if scr.is_base_scraper():
        return None
    return entity_from_scraper(scr, url)
