import data
import scraper

def entity_from_scraper(scr, url):
    latlng_json = scr.get_latlng()
    latlng = data.LatLng.from_json_obj(latlng_json) if latlng_json else None
    return data.Entity(name=scr.get_entity_name(),
        category=scr.get_category(), sub_category=scr.get_sub_category(),
        address=scr.get_address(), latlng=latlng, 
        address_precision=scr.get_location_precision(), rating=scr.get_rating(),
        primary_photo_url=scr.get_primary_photo(), photo_urls=scr.get_photos(),
        source_url=scr.get_url())

def scrape_entity_from_url(url, page_source=None):
    scr = scraper.build_scraper(url, page_source)
    if not scr or scr.is_base_scraper():
        return None
    return entity_from_scraper(scr, url)

def needs_page_source_to_scrape(url):
    return scraper.url_requires_page_source(url)
