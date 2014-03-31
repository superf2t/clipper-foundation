import serializable

class Category(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('category_id', 'name', 'display_name')

    def __init__(self, category_id=None, name=None, display_name=None):
        self.category_id = category_id
        self.name = name
        self.display_name = display_name

    def __str__(self):
        return self.name

Category.LODGING = Category(1, 'lodging', 'Lodging')
Category.FOOD_AND_DRINK = Category(2, 'food_and_drink', 'Food & Drink')
Category.ATTRACTIONS = Category(3, 'attractions', 'Attractions')

class SubCategory(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('sub_category_id', 'name', 'display_name')

    def __init__(self, sub_category_id=None, name=None, display_name=None):
        self.sub_category_id = sub_category_id
        self.name = name
        self.display_name = display_name

    def __str__(self):
        return self.name

SubCategory.HOTEL = SubCategory(1, 'hotel', 'Hotel')
SubCategory.PRIVATE_RENTAL = SubCategory(2, 'private_rental', 'Private rental')
SubCategory.RESTAURANT = SubCategory(3, 'restaurant', 'Restaurant')
SubCategory.BAR = SubCategory(4, 'bar', 'Bar')
