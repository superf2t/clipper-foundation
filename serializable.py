import json

class Serializable(object):
    '''Base class for objects that are JSON-serialization.

    Given a declaration of publicly-serializable fields,
    provides implementations that handle serialization and parsing.
    Requires that the class be able to be instantiated with 0 args.

    Usage:

    from serializable import Serializable, fields, objf, listf, objlistf

    class Deposit(Serializable):
        PUBLIC_FIELDS = fields('amount')

        def __init__(self, amount=None):
            ...

    class Account(Serializable):
        PUBLIC_FIELDS = ('name', balance', listf('owners'),
            objlistf('deposits', Deposit))

        def __init__(self, name=None, balance=None, owners=(), deposits=(),
            # Private field
            account_number=None):
            ...
    
    account = Account('Primary Account', 200.25, ['Bob', 'Mary'], deposits=
        [Deposit(100), Deposit(100.25)], 2534657)
    serialized = account.to_json_obj()
    parsed = Account.from_json_obj(serialized)
    '''
    PUBLIC_FIELDS = {}

    def to_json_str(self):
        return json.dumps(self.to_json_obj())

    def to_json_obj(self):
        obj = {}
        for name, field in self.PUBLIC_FIELDS.iteritems():
            raw_value = getattr(self, name)
            if raw_value is not None:
                obj[name] = field.json_serialize(raw_value)
        return obj

    @classmethod
    def from_json_str(cls, json_str):
        return cls.from_json_obj(json.loads(json_str))

    @classmethod
    def from_json_obj(cls, obj):
        instance = cls()
        for name, value in obj.iteritems():
            field = cls.PUBLIC_FIELDS.get(name)
            if not field:
                continue
            setattr(instance, name, field.json_parse(value))
        instance.initialize()
        return instance

    def initialize(self):
        # Hook to do custom initialization during deserialization,
        # like sanitization of values.
        pass

def fields(*args):
    spec = {}
    for arg in args:
        if isinstance(arg, Field):
            spec[arg.name] = arg
        else:
            spec[arg] = Field(arg)
    return spec

def listf(name):
    return Field(name, is_list=True)

def objf(name, cls):
    return Field(name, cls)

def objlistf(name, cls):
    return Field(name, cls, is_list=True)


class SerializationError(Exception):
    pass


def to_json_obj(obj):
    if type(obj) in (int, long, float, bool, str, unicode):
        return obj
    elif isinstance(obj, Serializable):
        return obj.to_json_obj()
    elif isinstance(obj, list):
        return [to_json_obj(o) for o in obj]
    elif isinstance(obj, dict):
        return dict((to_json_obj(key), to_json_obj(val)) for key, val in obj.iteritems())
    else:
        raise SerializationError('Object is not JSON-serializable: %s' % obj)


class Field(object):
    def __init__(self, name, cls=None, is_list=False):
        self.name = name
        self.cls = cls
        self.is_list = is_list

    def json_serialize(self, value):
        if self.is_list:
            if self.cls:
                try:
                    return [val.to_json_obj() for val in value]
                except AttributeError as e:
                    raise SerializationError(
                        'Encountered unserializable value: %s.  Original exception: %s' % (
                            value, e))
            else:
                return value
        elif self.cls:
            try:
                return value.to_json_obj()
            except AttributeError:
                raise SerializationError('Value is not serializable: %s' % value)
        elif isinstance(value, dict):
            return to_json_obj(value)
        else:
            return value

    def json_parse(self, value):
        if self.is_list:
            if self.cls:
                return [self.cls.from_json_obj(val) for val in value]
            else:
                return value
        elif self.cls:
            return self.cls.from_json_obj(value)
        else:
            return value
