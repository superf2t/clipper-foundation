import cStringIO
import re
import string
import urllib2

from lxml import etree

USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36'

def make_request(url):
    return urllib2.Request(url, headers={'User-Agent': USER_AGENT})

def parse_tree(url):
    req = make_request(url)
    html = urllib2.urlopen(req)
    parser = htmlparser()
    tree = etree.parse(html, parser)
    return tree

def parse_tree_from_string(page_source_string):
    html = cStringIO.StringIO(page_source_string)
    parser = htmlparser()
    return etree.parse(html, parser)

def htmlparser():
    # You're not supposed to need to specify the encoding here, lxml will
    # otherwise detect it from the input.  However, without specifying this,
    # character encoding is breaking on prod (EC2, Linux) while working properly
    # on dev (OSX) for mysterious reasons.  Forcing the encoding fixes it, but may
    # not work properly for non-utf-8 websites.
    # The problem can be demonstrated by running the following:
    # import urllib2, lxml
    # lxml.etree.parse(urllib2.urlopen('https://www.airbnb.com/rooms/2827655'),
    #    lxml.etree.HTMLParser()).getroot().find('body//div[@id="room"]//span[@id="display-address"]').text
    # This returns a string with an extra byte on prod.  Adding the forced encoding in the
    # above snippet fixes it.
    return etree.HTMLParser(encoding='utf-8')

def tostring_with_breaks(element, with_tail=False, strip_punctuation=True):
    raw_html = etree.tostring(element)
    elem = element
    if '<br/>' in raw_html or '<br>' in raw_html:
        modified_html = raw_html.replace('<br/>', '<br/> ').replace('<br>', '<br> ')
        elem = etree.fromstring(modified_html)
    value = etree.tostring(elem, encoding='unicode', method='text', with_tail=with_tail).strip()
    if strip_punctuation:
        value = value.strip(string.punctuation).strip()
    return value

def tostring(element, normalize_whitespace=False, with_tail=True):
    s = etree.tostring(element, encoding='unicode', method='text', with_tail=with_tail).strip()
    if normalize_whitespace:
        s = s.replace(u'\xc2', ' ').replace(u'\xa0', ' ')
        return re.sub('\s+', ' ', s)
    return s

def join_element_text_using_xpaths(root, xpaths, separator=' '):
    elems = [root.find(xpath) for xpath in xpaths]
    texts = [tostring(elem, with_tail=False) for elem in elems if elem is not None]
    return separator.join(texts)
