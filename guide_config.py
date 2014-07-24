class GuideConfig(object):
    def __init__(self, city_name, latlng_tuple, trip_plan_ids):
        self.city_name = city_name
        self.latlng = {
            'lat': latlng_tuple[0],
            'lng': latlng_tuple[1],
        }
        self.trip_plan_ids = trip_plan_ids

    @property
    def city_name_url_token(self):
        return self.city_name.lower().replace(' ', '-')

def make_guide_configs(*args_list):
    return tuple(GuideConfig(*args) for args in args_list)

GUIDES = make_guide_configs(
    ('London', (51.5073509, -0.1277583), (
        2349792342410454,
        1573932397149895,
        4415532549090454,
        3426431336940565,
        3535500607347055,
        335750901021916,
        4441241481829391
        )),
    ('Paris', (48.856614, 2.3522219), (
        1271668868632717,
        1972949063192752,
        991358595186578,
        3970343404298239,
        2673888203308439,
        2727628413049211
        )),
    ('New York City', (40.7127837, -74.0059413), (
        2066883252869202,
        1161797211171935,
        4007950464330075,
        3971327218426117,
        1527696232552002,
        703224853614045,
        2356056510215305,
        2744154876291433,
        4363511200080785
        )),
    ('Bangkok', (13.7278956, 100.5241235), (
        1976511814603165,
        3849784788168692,
        837084475162684,
        2457017335537847
        )),
    ('Barcelona', (41.3850639, 2.1734035), (
        3696246901682453,
        1599298693782748,
        2790252263350325,
        3315987235831120,
        4309629923075878,
        2494197823946247,
        3787799016911451,
        1472533263943904
        )),
    ('Rome', (41.8723889, 12.4801802), (
        1565584600856286,
        1846898897982880,
        264874526802500,
        2048021268140741,
        3050661111653477,
        4270072891603467,
        1234013566976744,
        827469142472552
        )),
    )

GUIDES_BY_CITY = dict((config.city_name, config) for config in GUIDES)
GUIDES_BY_CITY_URL_TOKEN = dict((config.city_name_url_token, config) for config in GUIDES)
