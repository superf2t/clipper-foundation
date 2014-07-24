import urlparse

import data
from database import user
from scraping import html_parsing
from scraping import tripadvisor

GUIDE_USER = 'travel@unicyclelabs.com'

def main():
    db_user = user.User.get_by_email(GUIDE_USER)
    all_trip_plans_for_user = data.load_all_trip_plans_for_creator(db_user.id)
    all_tripadvisor_trip_plans = []
    for trip_plan in all_trip_plans_for_user:
        if trip_plan.source_url and 'tripadvisor.com/Guide' in trip_plan.source_url:
            fix_trip_plan(trip_plan)

def fix_trip_plan(trip_plan):
    missing_descs = False
    for entity in trip_plan.entities:
        if not entity.description:
            missing_descs = True
    if not missing_descs:
        return

    description_overrides = {}
    root = html_parsing.parse_tree(trip_plan.source_url).getroot()
    for item in root.xpath('.//div[@id="GUIDE_DETAIL"]//div[@class="guideItemInfo"]'):
        rel_entity_source_url = item.xpath('.//a[@class="titleLink"]/@href')[0]
        entity_source_url = urlparse.urljoin(trip_plan.source_url, rel_entity_source_url)
        desc_node = item.xpath('.//p[contains(@id, "shortDesc")]')
        desc = None
        if desc_node:
            desc = html_parsing.tostring(desc_node[0])
        else:
            scr = tripadvisor.TripAdvisorScraper(
                entity_source_url, html_parsing.parse_tree(entity_source_url), True)
            desc = scr.get_description()
        if desc:
            description_overrides[entity_source_url] = desc

    needed_fixing = False
    for entity in trip_plan.entities:
        if not entity.description and description_overrides.get(entity.source_url):
            entity.description = description_overrides[entity.source_url]
            needed_fixing = True

    if needed_fixing:
        print 'Fixed trip plan (%d): %s' % (trip_plan.trip_plan_id, trip_plan.source_url)
        data.save_trip_plan(trip_plan)

if __name__ == '__main__':
    main()
