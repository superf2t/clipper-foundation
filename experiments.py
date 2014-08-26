import operator

class Experiments(object):
    def __init__(self, experiments):
        self.experiments_by_name = dict((e.name, e) for e in experiments)

    def get(self, name):
        return self.experiments_by_name.get(name)

    def has_active_experiments(self):
        return bool(self.experiments_by_name)

    def logging_string(self):
        sorted_exps = sorted(self.experiments_by_name.values(), key=operator.attrgetter('name'))
        return ';'.join(e.logging_string() for e in sorted_exps)

class Experiment(object):
    def __init__(self, name, values=None):
        self.name = name
        self.values = values or {}

    def get_value(self, key):
        return self.values.get(key)

    def logging_string(self):
        if not self.values:
            return self.name
        sorted_items = sorted(self.values.items(), key=lambda item: item[0])
        items_str = ','.join('%s:%s' % (k, v) for k, v in sorted_items)
        return '%s/%s' % (self.name, items_str)

def parse_from_cookies(cookies):
    experiments = []
    index_var = cookies.get('index_var')
    if index_var in ('1', '2', '3'):
        experiments.append(Experiment('index_variation', {'var': int(index_var)}))
    return Experiments(experiments)
