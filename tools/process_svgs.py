import fileinput
import os
import re
import sys

def process_file(infile, fname):
    print '''<script type="text/ng-template" id="%s-icon-template">''' % fname.split('.')[0]
    for line in infile:
        if should_skip(line):
            continue
        line = strip_tags(line)
        print '  ' + line,
        if '</svg>' in line and not line.endswith('\n'):
            print
    print '</script>'

def should_skip(line):
    return line.startswith('<?xml') or line.startswith('<!')

STRIP_ID_RE = re.compile('''id=["'][^"']+["']''')

def strip_tags(line):
    return STRIP_ID_RE.sub('', line)

def main(argv):
    for fname in argv[1:]:
        process_file(open(fname), os.path.basename(fname))
        print

if __name__ == '__main__':
    main(sys.argv)
