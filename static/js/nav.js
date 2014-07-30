// TODO:
// -Verify that the 'next' url is working properly when clicking the 'Join' link.
// -Add a prompt to save your work if you aren't logged in but have added multiple places.
// -Verify that favicons work for all guide sources (esp Nomadic Matt which was down).
// -Implement rendering for entity details listings that have no photos.
// -Figure out what to put on the About tab if there's no content (or hide it)
// -Add variable star ratings widget.
// -Have a display name for common source urls.
// -Clean up display language for opening hours.
// -Render and editing for entity tags.
// -Check whether the right entity name appears in the reclipping confirmation.
// -Add "Remember me" support for login.
// -Change the login page to target the iframe and not the top frame;
//  if successful, do a page reload.
// -Check new user flows, e.g. what happens if you come to /trip_plan without any trip plans.

// CLEANUP:
// -Delete the item model and put its remaining funcionality in EntityModel,
//  or just as scope methods.
// -Remove tutorial panel.
// -Remove day planner.
// -Remove notes

function NavCtrl($scope, $entityService, $modal, $timeout, $window) {
  $scope.openLoginModal = function(loginUrl, windowClass) {
    var scope = $scope.$new(true);
    scope.iframeUrl = loginUrl;
    var modal = $modal.open({
      templateUrl: 'login-modal-template',
      windowClass: windowClass,
      scope: scope
    });
    $window['closeLoginModal'] = function() {
      modal.close();
      $window['closeLoginModal'] = null;
    };
  };

  $scope.openNewTripModal = function(opt_callback, opt_clippingEntity) {
    var scope = $scope.$new();
    var modal = null;
    scope.onCreate = function(tripPlan) {
      if ($scope.shoppingCartMode) {
        $scope.activeTripPlan = tripPlan;
        $scope.allTripPlans.unshift(tripPlan);
        // Allow a digest cycle to happen before calling the callback.
        $timeout(opt_callback);
        modal && modal.close();
      } else {
        $window.location.href = '/trip_plan/' + tripPlan['trip_plan_id'];
      }
    };
    scope.clippingEntity = opt_clippingEntity;

    modal = $modal.open({
      templateUrl: 'new-trip-modal-template',
      windowClass: 'new-trip-modal-window',
      controller: NewTripCtrl,
      scope: scope
    });
  };

  $scope.$on('open-new-trip-modal', function(event, opt_callback, opt_clippingEntity) {
    $scope.openNewTripModal(opt_callback, opt_clippingEntity);
  });

  $scope.isActiveTrip = function(tripPlan) {
    return tripPlan && $scope.activeTripPlan
      && tripPlan['trip_plan_id'] == $scope.activeTripPlan['trip_plan_id'];
  };

  $scope.makeTripPlanActive = function(tripPlan) {
    $scope.activeTripPlan = tripPlan;
    $scope.numEntities = null;
    $entityService.getByTripPlanId(tripPlan['trip_plan_id'])
      .success(function(response) {
        $scope.numEntities = response['entities'].length;
      });
  };
}

function NewTripCtrl($scope, $tripPlanService, $timeout) {
  $scope.newTripPlan = {};
  $scope.results = null;
  $scope.saving = false;

  $timeout(function() {
    $scope.focusReady = true;
  }, 300);

  $scope.placeChanged = function(place) {
    if (!place['geometry']) {
      return $scope.searchForPlace(place['name']);
    }
    $scope.selectResult(place);
  };

  $scope.selectResult = function(place) {
    var oldTripName = $scope.newTripPlan['name'];
    $scope.newTripPlan = $scope.placeToTripPlanDetails(place);
    if (oldTripName) {
      $scope.newTripPlan['name'] = oldTripName;
    }
    $scope.results = [];
  };

  $scope.searchForPlace = function(query) {
    $scope.results = null;
    var request = {
      query: query
    };
    var dummyMap = new google.maps.Map($('<div>')[0], {
      center: new google.maps.LatLng(0, 0)
    });
    var searchService = new google.maps.places.PlacesService(dummyMap);
    searchService.textSearch(request, function(results, status) {
      $scope.$apply(function() {
        if (status != google.maps.places.PlacesServiceStatus.OK) {
          alert('Search failed, please try again.');
          return;
        }
        $.each(results, function(i, result) {
          if (result['icon'].indexOf('geocode') >= 0) {
            result['icon'] = '/static/img/place-proximity.svg';
          }
        });
        $scope.results = results;
      });
    });
  };

  $scope.placeToTripPlanDetails = function(place) {
    var geometry = place['geometry'];
    var location = geometry && geometry['location'];
    var viewport = geometry && geometry['viewport'];
    var tripPlanDetails = {
      'name': place['name'],
      'location_name': place['formatted_address']
    };
    if (location) {
      tripPlanDetails['location_latlng'] = {
        'lat': location.lat(),
        'lng': location.lng()
      };
    }
    if (viewport) {
      tripPlanDetails['location_bounds'] = {
        'southwest': {
          'lat': viewport.getSouthWest().lat(),
          'lng': viewport.getSouthWest().lng()
        },
        'northeast': {
          'lat': viewport.getNorthEast().lat(),
          'lng': viewport.getNorthEast().lng()
        }
      }
    }
    return tripPlanDetails;
  };

  $scope.saveNewTripPlan = function() {
    $scope.saving = true;
    $tripPlanService.saveNewTripPlan($scope.newTripPlan)
      .success(function(response) {
        $scope.saving = false;
        $scope.onCreate(response['trip_plans'][0]);
      });
  };
}

function TripPlanCreator($rootScope) {
  this.openNewTripPlanModal = function(opt_callback, opt_clippingEntity) {
    $rootScope.$broadcast('open-new-trip-modal', opt_callback, opt_clippingEntity);
  };
}

function tcNav() {
  return {
    restrict: 'AE',
    controller: NavCtrl,
    templateUrl: 'nav-template',
    scope: {
      accountInfo: '=',
      activeTripPlan: '=',
      numEntities: '=',
      allTripPlans: '=',
      shoppingCartMode: '='
    }
  };
}

function tcAccountDropdown() {
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'account-dropdown-template'
  };
}

function tcNavTripPlanDropdown() {
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'nav-trip-plan-dropdown-template'
  };
}

angular.module('navModule', ['servicesModule', 'directivesModule', 'ui.bootstrap'])
  .service('$tripPlanCreator', TripPlanCreator)
  .directive('tcNav', tcNav)
  .directive('tcAccountDropdown', tcAccountDropdown)
  .directive('tcNavTripPlanDropdown', tcNavTripPlanDropdown);
