import datetime
import re
import urlparse

from dateutil import tz

import data
import scrape_logic
from scraping import html_parsing
import utils

# TODO: Remove url as a param here since it's no longer used.
def entity_from_scraper(scr, url):
    latlng_json = scr.get_latlng()
    latlng = data.LatLng.from_json_obj(latlng_json) if latlng_json else None
    return data.Entity(
        name=scr.get_entity_name(),
        latlng=latlng,
        category=scr.get_category(), sub_category=scr.get_sub_category(),
        address=scr.get_address(),  
        address_precision=scr.get_location_precision(),
        phone_number=scr.get_phone_number(),
        opening_hours=scr.get_opening_hours(),
        website=scr.get_website(),
        rating=scr.get_rating(),
        rating_max=scr.get_rating_max(),
        review_count=scr.get_review_count(),
        starred=scr.get_starred(),
        description=scr.get_description(),
        primary_photo_url=scr.get_primary_photo(),
        photo_urls=scr.get_photos(),
        source_url=scr.get_source_url(),
        last_access_datetime=datetime.datetime.now(tz.tzutc()))

def scrape_entities_from_url(url, page_source=None, force_fetch_page=False,
        max_results=None, allow_expansion=True, for_guide=False):
    scrapers = scrape_logic.build_scrapers(url, page_source, force_fetch_page, for_guide=for_guide)
    scrapers = scrapers[:max_results] if max_results else scrapers
    return utils.parallelize(entity_from_scraper, [(scr, url) for scr in scrapers])

def needs_client_page_source_to_scrape(url):
    return scrape_logic.url_requires_client_page_source(url)

def scrape_entities_from_page_source(url, page_source):
    if scrape_logic.is_url_handleable(url):
        return scrape_entities_from_url(url, page_source)
    else:
        urls = extract_urls_from_page_source(url, page_source)
        handleable_urls = set(u for u in urls if scrape_logic.is_url_handleable(u, allow_expansion=False))
        entity_lists = utils.parallelize(scrape_entities_from_url,
            [(u, None, True, None, False) for u in handleable_urls])
        return utils.flatten(entity_lists)

def extract_urls_from_page_source(url, page_source):
    urls = []
    tree = html_parsing.parse_tree_from_string(page_source)
    urls.extend(extract_all_links_from_anchors(url, tree))
    urls.extend(extract_all_links_from_text(html_parsing.tostring(tree.getroot())))
    return urls

def extract_all_links_from_anchors(url, page_source_tree):
    urls = []
    links = page_source_tree.getroot().findall('.//a')
    for link in links:
        href = link.get('href')
        if href and (href.startswith('http') or href.startswith('/')):
            full_url = urlparse.urljoin(url, href)
            urls.append(full_url)
    return urls

TEXT_LINK_RE = re.compile('(?i)http(?:s)?://\S+')

def extract_all_links_from_text(text):
    return TEXT_LINK_RE.findall(text)
