import os

HYATT_TAHOE_URL = 'https://www.hyatt.com/hyatt/reservations/roomsAndRates.jsp?xactionid=145482245a8&_requestid=972056'
HILTON_PARIS_URL = 'https://secure3.hilton.com/en_US/hi/reservation/book.htm?execution=e3s1'

URL_TO_SOURCE_FILE = {
    HYATT_TAHOE_URL: 'hyatt_tahoe.html',
    HILTON_PARIS_URL: 'hilton_paris.html',
}

DIRNAME = os.path.dirname(__file__)

def get_page_source(url):
    fname = URL_TO_SOURCE_FILE.get(url)
    if fname:
        return open(os.path.join(DIRNAME, fname)).read()
    return None
