import operator
import re

def dict_from_attrs(objs, attr_name):
    attrgetter = operator.attrgetter(attr_name)
    return dict((attrgetter(obj), obj) for obj in objs)

LATLNG_SPLITTER = re.compile('[^\d.NSEW]+')

# Takes inputs of the form:
# 48^51'29.6"N, 2^17'40.2"E
# and returns their decimal equivalents
# (48.858222222222224, 2.2944999999999998)
def latlng_to_decimal(lat_str, lng_str):
    return {
        'lat': coord_to_decimal(lat_str),
        'lng': coord_to_decimal(lng_str)
        }

# Takes and input of the form 48^51'29.6"N and returns
# 48.858222222222224
def coord_to_decimal(coord_str):
    if type(coord_str) != unicode:
        coord_str = coord_str.decode('utf-8')
    parts = LATLNG_SPLITTER.split(coord_str)
    degrees, minutes, seconds, direction = (
        int(parts[0]), int(parts[1]), float(parts[2]), parts[3].upper())
    sign = 1 if direction in ('N', 'E') else -1
    return sign * (degrees + minutes / 60.0 + seconds / 3600.0)
