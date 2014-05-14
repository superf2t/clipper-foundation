import re
import urllib
import urllib2
import urlparse

import constants

LINK_REFERENCE_RE = re.compile('(?i)[^\.](src|href)\s*?\=\s*?[\'|"]?([^>\s\'"]+)[\'|"]?')
PROXY_URL_TEMPLATE = constants.BASE_URL + '/proxy?url=%s'

def is_absolute(url):
    lowered = url.lower()
    return (lowered.startswith('http') or lowered.startswith('//')
        or lowered.startswith('javascript') or lowered.startswith('mailto'))

def handle_match(base_url, match):
    url = match.group(2)
    if match.group(1).lower() == 'src' and is_absolute(url):
        return match.group(0)
    absolute_url = urlparse.urljoin(base_url, url)
    proxied_url = PROXY_URL_TEMPLATE % urllib.quote(absolute_url)
    return match.group(0).replace(url, proxied_url)

def fix_urls(base_url, html):
    return LINK_REFERENCE_RE.sub(lambda match: handle_match(base_url, match), html)

def rewrite_page(page_url, headers):
    req = urllib2.Request(page_url, headers={'User-Agent': headers.get('User-Agent')})
    response = urllib2.urlopen(req)
    html = response.read()
    fixed_html = fix_urls(page_url, html)
    return fixed_html, response.info()

if __name__ == '__main__':
    print rewrite_page('http://www.yelp.com/search?find_desc=restaurants&find_loc=Portland%2C+OR&ns=1', {})
