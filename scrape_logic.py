import urllib2

from lxml import etree

from scraping import html_parsing
import utils

from scraping import airbnb
from scraping import booking_dot_com
from scraping import fodors
from scraping import foursquare
from scraping import gogobot
from scraping import hilton
from scraping import hotels_dot_com
from scraping import hyatt
from scraping import lonely_planet
from scraping import starwood
from scraping import tripadvisor
from scraping import wikipedia
from scraping import yelp
from scraping import zagat

ALL_SCRAPERS = (
    airbnb.AirbnbScraper,
    booking_dot_com.BookingDotComScraper,
    fodors.FodorsScraper,
    foursquare.FoursquareScraper,
    gogobot.GogobotScraper,
    hilton.HiltonScraper,
    hotels_dot_com.HotelsDotComScraper,
    hyatt.HyattScraper,
    lonely_planet.LonelyPlanetScraper,
    starwood.StarwoodScraper,
    tripadvisor.TripAdvisorScraper,
    wikipedia.WikipediaScraper,
    yelp.YelpScraper,
    zagat.ZagatScraper,
    )

def build_scrapers(url, client_page_source=None, force_fetch_page=False,
        allow_expansion=True, for_guide=False):
    page_source_tree = html_parsing.parse_tree_from_string(client_page_source) if client_page_source else None
    if not page_source_tree and (url_requires_server_page_source(url) or force_fetch_page):
        page_source_tree = html_parsing.parse_tree(url)

    scraped_pages = []
    for scraper_class in ALL_SCRAPERS:
        handleable_urls = scraper_class.handleable_urls(url, page_source_tree, allow_expansion)
        if handleable_urls:
            reqs = [html_parsing.make_request(u) for u in handleable_urls]
            resps = utils.parallelize(utils.retryable(urllib2.urlopen, 3), [(req,) for req in reqs])
            for url, resp in zip(handleable_urls, resps):
                if not resp:
                    print 'Failed to fetch url: %s' % url
                    continue
                tree = etree.parse(resp, html_parsing.htmlparser())
                scraper = scraper_class(url, tree, for_guide)
                scraped_pages.append(scraper)
            break
    return scraped_pages

def build_scraper(url, page_source=None):
    scrapers = build_scrapers(url, page_source)
    return scrapers[0] if scrapers else None

def url_requires_client_page_source(url):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.url_requires_client_page_source(url):
            return True
    return False

def url_requires_server_page_source(url):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.url_requires_server_page_source(url):
            return True
    return False

def is_url_handleable(url, allow_expansion=True):
    for scraper_class in ALL_SCRAPERS:
        if scraper_class.is_url_handleable(url, allow_expansion):
            return True
    return False

if __name__ == '__main__':
    from tests.testdata import scraper_page_source
    for url in (
        'http://www.tripadvisor.com/Hotel_Review-g298570-d301416-Reviews-Mandarin_Oriental_Kuala_Lumpur-Kuala_Lumpur_Wilayah_Persekutuan.html',
        'http://www.tripadvisor.com/Hotel_Review-g60713-d224953-Reviews-Four_Seasons_Hotel_San_Francisco-San_Francisco_California.html',
        'http://www.tripadvisor.com/Restaurant_Review-g60616-d1390699-Reviews-Hukilau_Lanai-Kapaa_Kauai_Hawaii.html',
        'http://www.tripadvisor.com/Attractions-g255060-Activities-Sydney_New_South_Wales.html',
        'http://www.yelp.com/biz/mandarin-oriental-san-francisco-san-francisco-4',
        'http://www.yelp.com/biz/ikes-place-san-francisco',
        'http://www.hotels.com/hotel/details.html?tab=description&hotelId=336749',
        'http://www.hotels.com/hotel/details.html?pa=1&pn=1&ps=1&tab=description&destinationId=1493604&searchDestination=San+Francisco&hotelId=108742&rooms[0].numberOfAdults=2&roomno=1&validate=false&previousDateful=false&reviewOrder=date_newest_first',
        'http://www.hotels.com/ho276485/hotel-banke-paris-france/?gclid=CIHStK3B470CFc1afgodSjMAVg&hotelid=276485&PSRC=G21&rffrid=sem.hcom.US.google.003.03.02.s.kwrd%3DZzZz.s1lKbc1kl.0.33721657110.10205l017840.d.c',
        'http://www.hotels.com/search.do?current-location=Kuala+Lumpur%2C+Malaysia&arrivalDate=&departureDate=&searchParams.rooms.compact_occupancy_dropdown=compact_occupancy_1_2&rooms=1&searchParams.rooms%5B0%5D.numberOfAdults=2&children%5B0%5D=0&srsReport=HomePage%7CAutoS%7Ccity%7Cchicago%7C6%7C3%7C3%7C3%7C1%7C15%7C1497539&pageName=HomePage&searchParams.landmark=&resolvedLocation=CITY%3A1497539%3APROVIDED%3APROVIDED#pageName=SearchResultPage&dn=Chicago,+Illinois,+United+States&nr=1&pn=1&upn=0&so=BEST_SELLER&vt=LIST&rl=CITY%3A1497539%3APROVIDED%3APROVIDED&pfm=1&pfcc=USD&maxp=500&sr%5B%5D=5&sr%5B%5D=4&ming=4&r=2&cpr=0,'
        'https://www.airbnb.com/rooms/2407670',
        'https://www.airbnb.com/rooms/2576604',
        'https://www.airbnb.com/rooms/1581737',
        'http://www.booking.com/hotel/my/mandarin-oriental-kuala-lumpur.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1;checkin=2014-05-03;interval=1',
        'http://www.booking.com/hotel/fr/st-christopher-s-inn-paris-gare-du-nord.en-us.html',
        'http://www.booking.com/hotel/us/candlelight-inn-bed-and-breakfast.en-us.html?sid=f94501b12f2c6f1d49c1ce791d54a06c;dcid=1',
        'https://www.hyatt.com/hyatt/reservations/roomsAndRates.jsp?xactionid=145482245a8&_requestid=972056',
        'http://regencyboston.hyatt.com/en/hotel/home.html',
        'http://bangalore.hyatthotels.hyatt.com/en/hotel/dining.html',
        'http://www.starwoodhotels.com/preferredguest/property/overview/index.html?propertyID=1153',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=1488',
        'http://www.starwoodhotels.com/luxury/property/overview/index.html?propertyID=250',
        'http://www3.hilton.com/en/hotels/illinois/hilton-chicago-CHICHHH/index.html',
        'http://www3.hilton.com/en/hotels/france/concorde-opra-paris-PAROPHI/index.html',
        'http://www3.hilton.com/en/hotels/united-kingdom/the-trafalgar-london-LONTSHI/accommodations/index.html',
        'https://secure3.hilton.com/en_US/hi/reservation/book.htm?execution=e3s1',
        'http://www3.hilton.com/en/hotels/ohio/hilton-akron-fairlawn-CAKHWHF/index.html',
        'http://www.lonelyplanet.com/usa/san-francisco/restaurants/american/benu',
        'http://www.lonelyplanet.com/spain/barcelona/hotels/hostal-abrevadero',
        'http://www.lonelyplanet.com/kenya/wasini-island/sights/nature-wildlife/kisite-marine-national-park',
        'http://www.lonelyplanet.com/spain/barcelona/entertainment-nightlife/other/la-caseta-del-migdia',
        'http://www.lonelyplanet.com/united-arab-emirates/dubai/shopping/markets-streets-arcades/fish-market',
        'http://www.fodors.com/world/europe/italy/rome/review-472395.html',
        'http://www.fodors.com/world/north-america/usa/california/san-francisco/review-577818.html',
        'http://www.fodors.com/world/caribbean/us-virgin-islands/st-thomas/review-153132.html',
        'http://www.fodors.com/world/south-america/ecuador/the-galapagos-islands/review-449176.html',
        'http://www.fodors.com/world/europe/spain/barcelona/review-164246.html',
        'http://www.fodors.com/world/africa-and-middle-east/kenya/review-586358.html',
        'http://www.fodors.com/world/europe/italy/rome/review-38440.html',
        'http://en.wikipedia.org/wiki/San_Francisco_Ferry_Building',
        'http://en.wikipedia.org/wiki/Eiffel_tower',
        'http://en.wikipedia.org/wiki/Bahnhofstrasse',
        'https://foursquare.com/v/pacific-catch-9th-ave-san-francisco-ca/49dd5b31f964a520fe5f1fe3',
        'http://www.zagat.com/r/quince-san-francisco',
        'http://www.zagat.com/n/bourbon-branch-san-francisco',
        'http://www.gogobot.com/eiffel-tower-paris-attraction',
        'http://www.gogobot.com/hotel-ritz-paris-paris-hotel',
        'http://www.gogobot.com/paris--things_to_do',
        ):
        scrapers = build_scrapers(url, scraper_page_source.get_page_source(url), force_fetch_page=True)
        for scraper in scrapers:
            print scraper.debug_string()
            print scraper.get_latlng()
            print scraper.get_location_precision()
        print '-----'
