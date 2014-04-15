def enumdata(**kwargs):
    return kwargs

def enum(*values, **values_with_args):
    enum_values = []
    for value in values:
        enum_values.append(EnumValue(value))
    for name, extra_kwargs in values_with_args.iteritems():
        enum_values.append(EnumValue(name, **extra_kwargs))
    enums = dict((enum_value.name, enum_value) for enum_value in enum_values)
    values_by_name = enums.copy()
    enums['name_mapping'] = values_by_name
    return type('Enum', (object,), enums)

class EnumValue(object):
    def __init__(self, name, **kwargs):
        self.name = name
        self.__dict__.update(kwargs)

    def __str__(self):
        return self.name

    def __repr__(self):
        return '<EnumValue %s>' % self.name
