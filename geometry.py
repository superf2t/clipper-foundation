import math

EARTH_RADIUS_METERS = 6373 * 1000

# From http://www.johndcook.com/python_longitude_latitude.html
# Approximation based on the earth as a perfect sphere
def earth_distance_meters(lat1, lng1, lat2, lng2):

    # Convert latitude and longitude to 
    # spherical coordinates in radians.
    degrees_to_radians = math.pi / 180.0
        
    # phi = 90 - latitude
    phi1 = (90.0 - lat1) * degrees_to_radians
    phi2 = (90.0 - lat2) * degrees_to_radians
        
    # theta = longitude
    theta1 = lng1 * degrees_to_radians
    theta2 = lng2 * degrees_to_radians
        
    # Compute spherical distance from spherical coordinates.
        
    # For two locations in spherical coordinates 
    # (1, theta, phi) and (1, theta, phi)
    # cosine( arc length ) = 
    #    sin phi sin phi' cos(theta-theta') + cos phi cos phi'
    # distance = rho * arc length
    
    cos = (math.sin(phi1) * math.sin(phi2) * math.cos(theta1 - theta2) + 
           math.cos(phi1) * math.cos(phi2))
    if cos > 1:
        cos = 1
    arc = math.acos(cos)

    return arc * EARTH_RADIUS_METERS
