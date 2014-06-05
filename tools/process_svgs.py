import fileinput
import os
import re
import sys

def process_file(infile, fname):
    print '''<script type="text/ng-template" id="%s-icon-template">''' % fname.split('.')[0]
    active_close_tag = None
    for line in infile:
        line = line.strip()
        if not active_close_tag:
            active_close_tag = look_for_skip_tag(line)
        if should_skip(line) or active_close_tag:
            if active_close_tag and (active_close_tag in line):
                active_close_tag = None
            continue
        line = strip_tags(line)
        print '  ' + line
    print '</script>'

def should_skip(line):
    return line.startswith('<?xml') or line.startswith('<!')

def look_for_skip_tag(line):
    if line.startswith('<g ') and 'display="none"' in line:
        return '</g>'
    if '<style' in line:
        return '</style>'
    return None

STRIP_TAGS_RE = re.compile('''(id|class)=["'][^"']+["']''')

def strip_tags(line):
    return STRIP_TAGS_RE.sub('', line)

def main(argv):
    for fname in argv[1:]:
        process_file(open(fname), os.path.basename(fname))
        print

if __name__ == '__main__':
    main(sys.argv)
