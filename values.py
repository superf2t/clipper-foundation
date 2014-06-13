import operator

import serializable

class Category(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('category_id', 'name', 'display_name')

    def __init__(self, category_id=None, name=None, display_name=None):
        self.category_id = category_id
        self.name = name
        self.display_name = display_name

    def __str__(self):
        return self.name

Category.NONE = Category(0, 'none', 'None')
Category.LODGING = Category(1, 'lodging', 'Lodging')
Category.FOOD_AND_DRINK = Category(2, 'food_and_drink', 'Food & Drink')
Category.ATTRACTIONS = Category(3, 'attractions', 'Attractions')
Category.ACTIVITIES = Category(4, 'activities', 'Activities')
Category.SHOPPING = Category(5, 'shopping', 'Shopping')
Category.ENTERTAINMENT = Category(6, 'entertainment', 'Entertainment & Performance')
Category.REGION = Category(7, 'region', 'Regions')
Category.TRANSPORTATION = Category(8, 'transportation', 'Transportation')

ALL_CATEGORIES = sorted([c for c in Category.__dict__.itervalues() if isinstance(c, Category)],
    key=operator.attrgetter('category_id'))

class SubCategory(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('sub_category_id', 'name', 'display_name', 'category_id')

    def __init__(self, sub_category_id=None, name=None, display_name=None, category_id=None):
        self.sub_category_id = sub_category_id
        self.name = name
        self.display_name = display_name
        self.category_id = category_id

    def __str__(self):
        return self.name

# Next id: 31

SubCategory.NONE = SubCategory(0, 'none', 'None')

SubCategory.HOTEL = SubCategory(1, 'hotel', 'Hotel', Category.LODGING.category_id)
SubCategory.PRIVATE_RENTAL = SubCategory(2, 'private_rental', 'Private rental', Category.LODGING.category_id)
SubCategory.BED_AND_BREAKFAST = SubCategory(5, 'bed_and_breakfast', 'Bed & Breakfast', Category.LODGING.category_id)
SubCategory.HOSTEL = SubCategory(6, 'hostel', 'Hostel', Category.LODGING.category_id)
SubCategory.COUCHSURFING = SubCategory(7, 'couchsurfing', 'Couchsurfing', Category.LODGING.category_id)
SubCategory.FRIENDS_AND_FAMILY = SubCategory(8, 'friends_and_family', 'Friends & Family', Category.LODGING.category_id)

SubCategory.RESTAURANT = SubCategory(3, 'restaurant', 'Restaurant', Category.FOOD_AND_DRINK.category_id)
SubCategory.BAR = SubCategory(4, 'bar', 'Bar', Category.FOOD_AND_DRINK.category_id)
SubCategory.NIGHTCLUB = SubCategory(9, 'nightclub', 'Nightclub', Category.FOOD_AND_DRINK.category_id)
SubCategory.FOOD_TRUCK = SubCategory(10, 'food_truck', 'Food Truck', Category.FOOD_AND_DRINK.category_id)
SubCategory.STREET_FOOD = SubCategory(11, 'street_food', 'Street Food', Category.FOOD_AND_DRINK.category_id)
SubCategory.COFFEE_SHOP = SubCategory(20, 'coffee_shop', 'Coffee Shop', Category.FOOD_AND_DRINK.category_id)
SubCategory.BAKERY = SubCategory(23, 'bakery', 'Bakery', Category.FOOD_AND_DRINK.category_id)
SubCategory.DESSERT = SubCategory(24, 'dessert', 'Dessert', Category.FOOD_AND_DRINK.category_id)

SubCategory.LANDMARK = SubCategory(12, 'landmark', 'Landmark', Category.ATTRACTIONS.category_id)
SubCategory.MUSEUM = SubCategory(13, 'museum', 'Museum', Category.ATTRACTIONS.category_id)

SubCategory.TOUR = SubCategory(14, 'tour', 'Tour', Category.ACTIVITIES.category_id)
SubCategory.OUTDOOR = SubCategory(15, 'outdoor', 'Outdoor', Category.ACTIVITIES.category_id)

SubCategory.MUSIC = SubCategory(16, 'music', 'Music', Category.ENTERTAINMENT.category_id)
SubCategory.THEATER = SubCategory(17, 'theater', 'Theater', Category.ENTERTAINMENT.category_id)
SubCategory.SPORTS = SubCategory(18, 'sports', 'Sports', Category.ENTERTAINMENT.category_id)
SubCategory.DANCE = SubCategory(19, 'dance', 'Dance', Category.ENTERTAINMENT.category_id)
SubCategory.COMEDY = SubCategory(21, 'comedy', 'Comedy', Category.ENTERTAINMENT.category_id)

SubCategory.CITY = SubCategory(25, 'city', 'City', Category.REGION.category_id)
SubCategory.NEIGHBORHOOD = SubCategory(26, 'neighborhood', 'Neighborhood', Category.REGION.category_id)

SubCategory.AIRPORT = SubCategory(27, 'airport', 'Airport', Category.TRANSPORTATION.category_id)
SubCategory.TRAIN_STATION = SubCategory(28, 'train_station', 'Train Station', Category.TRANSPORTATION.category_id)
SubCategory.BUS_STATION = SubCategory(29, 'bus_station', 'Bus Station', Category.TRANSPORTATION.category_id)
SubCategory.CAR_RENTAL = SubCategory(30, 'car_rental', 'Car Rental', Category.TRANSPORTATION.category_id)

ALL_SUBCATEGORIES = sorted([s for s in SubCategory.__dict__.itervalues() if isinstance(s, SubCategory)],
    key=operator.attrgetter('sub_category_id'))

class ValueCollection(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(
        serializable.objlistf('categories', Category),
        serializable.objlistf('sub_categories', SubCategory))

    def __init__(self, categories=(), sub_categories=()):
        self.categories = categories
        self.sub_categories = sub_categories


ALL_VALUES = ValueCollection(ALL_CATEGORIES, ALL_SUBCATEGORIES)
