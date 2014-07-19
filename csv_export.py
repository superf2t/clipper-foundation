import csv
import cStringIO

HANDLERS = {
    'category': lambda c: c.display_name if c and c.category_id else None,
    'sub_category': lambda s: s.display_name if s and s.sub_category_id else None,
    'comments': lambda comments: '\n'.join(format_comment(c) for c in (comments or [])),
}

def format_comment(comment):
    return '%s at %s\n%s' % (comment.user.display_name,
        comment.last_modified_datetime().strftime('%b %d, %Y %I:%M %p'),
        comment.text)

DEFAULT_HANDLER = lambda value: value

def create_csv(entities):
    csvfile = cStringIO.StringIO()
    writer = csv.writer(csvfile)
    ordered_attrs = ['name', 'address', 'category', 'sub_category', 'description', 'comments', 'starred', 'day']    
    writer.writerow(ordered_attrs)
    for entity in entities:
        row = []
        for attr in ordered_attrs:
            handler = HANDLERS.get(attr, DEFAULT_HANDLER)
            row.append(handler(getattr(entity, attr)))
        writer.writerow([unicode(s or '').encode('utf-8') for s in row])
    filetext = csvfile.getvalue()
    csvfile.close()
    return filetext
