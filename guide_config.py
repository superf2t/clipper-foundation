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
        4441241481829391,
        90781981015411,
        503334204630736,
        3110978237811327,
        3892554662880744,
        2483240035181020,
        1376068812745024
        )),
    ('Paris', (48.856614, 2.3522219), (
        1271668868632717,
        1972949063192752,
        991358595186578,
        3970343404298239,
        3506536055094896,
        2856484047054143,
        2315929782106540,
        2673888203308439,
        2727628413049211,
        1041861679098485,
        1048030624166435
        )),
    ('New York City', (40.7127837, -74.0059413), (
        2066883252869202,
        1161797211171935,
        4007950464330075,
        3971327218426117,
        2190744920238290,
        1527696232552002,
        703224853614045,
        2356056510215305,
        2744154876291433,
        4363511200080785,
        1076804354367220,
        508984775745061,
        802868843821304,
        1919694675660346,
        1028359796473247,
        2892439148162208
        )),
    ('Bangkok', (13.7278956, 100.5241235), (
        1976511814603165,
        3849784788168692,
        837084475162684,
        2457017335537847,
        4446299954679609,
        2770725067368285,
        4470194741718403
        )),
    ('Barcelona', (41.3850639, 2.1734035), (
        3696246901682453,
        1599298693782748,
        2790252263350325,
        3315987235831120,
        4309629923075878,
        2494197823946247,
        3787799016911451,
        1472533263943904,
        2408528231672714,
        1261630642482049,
        2061874479913405,
        3772239764655778
        )),
    ('Rome', (41.8723889, 12.4801802), (
        1565584600856286,
        1846898897982880,
        264874526802500,
        2048021268140741,
        3050661111653477,
        4270072891603467,
        1234013566976744,
        827469142472552,
        2424130524977307,
        899390696279100,
        4319096271590092
        )),
    ('San Francisco', (37.7749295, -122.4194155), (
        78730837792382,
        3448980704880151,
        3574135666843452,
        1380349836013608,
        222261080626054,
        47578142235183,
        869664764069914,
        1902329412856495,
        2707557936480172,
        191470874877716,
        2391575744965908
        )),
    ('Las Vegas', (36.1699412,  -115.1398296), (
        121922190766635,
        2712810921148442,
        339556570882458,
        2175787001371384,
        1898777171531653,
        3428784237304782,
        160481547867022,
        3548293105775198
        )),
    )

GUIDES_BY_CITY = dict((config.city_name, config) for config in GUIDES)
GUIDES_BY_CITY_URL_TOKEN = dict((config.city_name_url_token, config) for config in GUIDES)

SOURCE_HOST_TO_ICON_URL = {
    'www.bonappetit.com': 'http://www.bonappetit.com/wp-content/themes/bonappetit-2.0.0/i/icons/favicon.ico',
    'www.frommers.com': "http://www.frommers.com/favicon.ico",
    'www.fodors.com': "http://www.fodors.com/favicon.ico",
    'www.lonelyplanet.com': 'http://www.lonelyplanet.com/favicon.ico',
    'www.nytimes.com': 'http://www.nytimes.com/favicon.ico',
    'www.nomadicmatt.com': 'http://www.nomadicmatt.com/favicon.ico',
    'www.hemispheresmagazine.com': 'http://www.hemispheresmagazine.com/images/favicon.ico',
    'www.ricksteves.com': 'http://www.ricksteves.com/assets/favicon.ico',
    'www.travelandleisure.com': 'http://www.travelandleisure.com/favicon.ico',
    'www.thrillist.com': 'http://www.thrillist.com/thrillist_favicon.ico',
    'www.tripadvisor.com': 'http://tripadvisor.com/favicon.ico',
    'www.zagat.com': 'http://www.zagat.com/favicon.ico',
}

SOURCE_HOST_TO_DISPLAY_NAME = {
    'www.bonappetit.com': 'Bon Appetit',
    'www.frommers.com': "Frommer's",
    'www.fodors.com': "Fodor's",
    'www.lonelyplanet.com': 'Lonely Planet',
    'www.nytimes.com': 'The New York Times',
    'www.nomadicmatt.com': 'Nomadic Matt',
    'www.hemispheresmagazine.com': 'United Hemispheres',
    'www.ricksteves.com': 'Rick Steves',
    'www.travelandleisure.com': 'Travel & Leisure',
    'www.thrillist.com': 'Thrillist',
    'www.tripadvisor.com': 'TripAdvisor',
    'www.zagat.com': 'Zagat',
}
