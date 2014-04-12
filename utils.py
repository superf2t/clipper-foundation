import operator

def dict_from_attrs(objs, attr_name):
    attrgetter = operator.attrgetter(attr_name)
    return dict((attrgetter(obj), obj) for obj in objs)
