import re
import sys
import time
import urlparse

from scraping import html_parsing

POST_COUNT_RE = re.compile('.+ \(([\d,]+)\)')

def get_forum_urls_from_region_page(url, region_depth=1, city_depth=1):
    region_page_urls = get_ta_urls(url, region_depth)
    city_page_base_urls = []
    for url in region_page_urls:
        root = parse_root(url)
        if root is None:
            continue
        for relative_url in root.xpath('.//td[contains(@class, "forumcol")]//a/@href'):
            city_page_base_urls.append(absurl(url, relative_url))
    city_page_urls = set()
    for base_url in city_page_base_urls:
        city_page_urls.update(get_ta_urls(base_url, city_depth))

    member_urls = set()
    for city_page_url in city_page_urls:
        root = parse_root(city_page_url)
        if root is None:
            continue
        for relative_url in root.xpath('.//td//div[contains(@class, "bymember")]//a/@href'):
            member_urls.add(absurl(city_page_url, relative_url))

    for member_url in member_urls:
        root = parse_root(member_url)
        if root is None:
            continue
        num_reviews = None
        num_forum_posts = None
        for li in root.xpath('.//ul[contains(@class, "public")]//ul/li'):
            text = html_parsing.tostring(li)
            if 'Reviews' in text:
                num_reviews = int(POST_COUNT_RE.match(text).group(1).replace(',', ''))
            elif 'Forums' in text:
                num_forum_posts = int(POST_COUNT_RE.match(text).group(1).replace(',', ''))
        print '%s,%s,%s' % (member_url, num_reviews or 0, num_forum_posts or 0)


def get_ta_urls(url, depth=1):
    urls = [url]
    if depth > 1:
        url_parts = url.rsplit('-', 1)
        for i in xrange(1, depth):
            next_page_url = '%s-o%d-%s' % (url_parts[0], i * 20, url_parts[1])
            urls.append(next_page_url)
    return urls

def absurl(base, relative):
    return urlparse.urljoin(base, relative)

def parse_root(url, sleep_time_secs=0.25):
    if sleep_time_secs:
        time.sleep(sleep_time_secs)
    try:
        return html_parsing.parse_tree(url).getroot()
    except:
        print >> sys.stderr, 'Bad url: %s' % url
        return None

if __name__ == '__main__':
    get_forum_urls_from_region_page(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
