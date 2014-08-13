import csv
import cStringIO

def format_comment(comment):
    return '%s at %s\n%s' % (comment.user.display_name,
        comment.last_modified_datetime().strftime('%b %d, %Y %I:%M %p'),
        comment.text)

def reputation_field_handler(value, entity):
    if entity.source_is_trusted_for_reputation:
        return value
    return None

HANDLERS = {
    'category': lambda c, entity: c.display_name if c and c.category_id else None,
    'sub_category': lambda s, entity: s.display_name if s and s.sub_category_id else None,
    'comments': lambda comments, entity: '\n'.join(format_comment(c) for c in (comments or [])),
    'tags': lambda tags, entity: ', '.join(tag.text for tag in tags),
    'opening_hours': lambda hours, entity: hours.as_string,
    'rating': reputation_field_handler,
    'rating_max': reputation_field_handler,
    'review_count': reputation_field_handler,
}

DEFAULT_HANDLER = lambda value, entity: value

def create_csv(entities):
    csvfile = cStringIO.StringIO()
    writer = csv.writer(csvfile)
    ordered_attrs = ['name', 'category', 'sub_category', 'description',
        'comments', 'starred', 'tags',
        'address', 'phone_number', 'opening_hours', 'website',
        'rating', 'rating_max', 'review_count']
    writer.writerow(ordered_attrs)
    for entity in entities:
        row = []
        for attr in ordered_attrs:
            handler = HANDLERS.get(attr, DEFAULT_HANDLER)
            row.append(handler(getattr(entity, attr), entity))
        writer.writerow([unicode(s or '').encode('utf-8') for s in row])
    filetext = csvfile.getvalue()
    csvfile.close()
    return filetext
