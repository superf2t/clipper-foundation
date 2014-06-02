import operator
import Queue
import re
import threading
import time

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
    if len(parts) == 3:
        parts.insert(2, 0.0)
    degrees, minutes, seconds, direction = (
        int(parts[0]), int(parts[1]), float(parts[2]), parts[3].upper())
    sign = 1 if direction in ('N', 'E') else -1
    return sign * (degrees + minutes / 60.0 + seconds / 3600.0)

def parallelize(fn, args_list, max_threads=50):
    in_queue = Queue.Queue()
    out_queue = Queue.Queue()

    for index, args in enumerate(args_list):
        in_queue.put((args, index))

    def target():
        while not in_queue.empty():
            args, index = in_queue.get()
            value = fn(*args)
            out_queue.put((value, index))

    num_threads = min(len(args_list), max_threads) if max_threads else len(args_list)
    threads = []
    for _ in xrange(num_threads):
        thread = threading.Thread(target=target)
        threads.append(thread)
        thread.start()
    for thread in threads:
        thread.join()

    response = [None] * len(args_list)
    while not out_queue.empty():
        item = out_queue.get()
        response[item[1]] = item[0]
    return response

def retryable(fn, retries, raise_on_fail=False):
    if retries < 1:
        raise Exception('Must give a positive number of retries, instead given %s' % retries)
    def fn_with_retries(*args):
        local_retries = retries
        resp = None
        last_exception = None
        while local_retries > 0:
            try:
                resp = fn(*args)
            except Exception as e:
                last_exception = e
            if resp:
                return resp
            else:
                local_retries -= 1
        if raise_on_fail and last_exception:
            raise last_exception
        return resp
    return fn_with_retries
