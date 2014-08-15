// TODO:
// -Add a prompt to save your work if you aren't logged in but have added multiple places.

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
    $window['loginCompleteRedirect'] = function(url) {
      modal.close();
      $window.location.href = url;
    };
  };

  $scope.openNewTripModal = function(opt_callback, opt_clippingEntity) {
    var scope = $scope.$new();
    var modal = null;
    scope.onCreate = function(tripPlan) {
      if ($scope.shoppingCartMode) {
        $scope.makeTripPlanActive(tripPlan);
        $scope.allTripPlans.unshift(tripPlan);
        // Allow a digest cycle to happen before calling the callback.
        $timeout(function() {
          opt_callback && opt_callback(tripPlan);
        });
        modal && modal.close();
      } else {
        $window.location.href = '/guide/' + tripPlan['trip_plan_id'];
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

function NewTripCtrl($scope, $tripPlanService, $eventTracker, $timeout) {
  $scope.newTripPlan = {};
  $scope.results = null;
  $scope.saving = false;

  $timeout(function() {
    $scope.focusReady = true;
  }, 300);

  $scope.placeChanged = function(place) {
    if (!place['geometry']) {
      $scope.searchForPlace(place['name']);
      $eventTracker.track({name: 'new-trip-location-search',
        location: 'new-trip-modal', value: place['name']});
      return;
    }
    $scope.selectResult(place);
    $eventTracker.track({name: 'new-trip-location-autocomplete',
      location: 'new-trip-modal', value: place['name']});
  };

  $scope.selectResult = function(place) {
    var oldTripName = $scope.newTripPlan['name'];
    $scope.newTripPlan = $scope.placeToTripPlanDetails(place);
    if (oldTripName) {
      $scope.newTripPlan['name'] = oldTripName;
    }
    $scope.results = [];

    $eventTracker.track({name: 'new-trip-location-result-selected',
      location: 'new-trip-modal', value: place['name']});
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
        $eventTracker.sendConversion('new-guide-created');
      });
  };

  $scope.$watch("newTripPlan['name']", function(newName, oldName) {
    if (newName && oldName) {
      $eventTracker.track({name: 'new-trip-plan-name-changed',
        location: 'new-trip-modal', value: newName});
    }
  });
}

function TripPlanCreator($rootScope) {
  this.openNewTripPlanModal = function(opt_callback, opt_clippingEntity) {
    $rootScope.$broadcast('open-new-trip-modal', opt_callback, opt_clippingEntity);
  };
}

function FlashedMessagesCtrl($scope, $timeout) {
  $scope.dismissing = false;

  $scope.hasMessages = function() {
    return !_.isEmpty($scope.messages);
  };

  $scope.dismiss = function(index) {
    $scope.messages.splice(index, 1);
  };

  $timeout(function() {
    $scope.dismissing = true;
    $timeout(function() {
      $scope.messages = [];
    }, 1000);
  }, 4000);
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

function tcFlashedMessages() {
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'flashed-messages-template',
    controller: FlashedMessagesCtrl,
    scope: {
      messages: '='
    }
  };
}

angular.module('navModule', ['servicesModule', 'directivesModule',
    'eventTrackingModule', 'ui.bootstrap'])
  .service('$tripPlanCreator', TripPlanCreator)
  .directive('tcNav', tcNav)
  .directive('tcAccountDropdown', tcAccountDropdown)
  .directive('tcNavTripPlanDropdown', tcNavTripPlanDropdown)
  .directive('tcFlashedMessages', tcFlashedMessages);


// TODO: Move event code to its own file.

var CONVERSION_EVENTS = {
    'new-guide-created': [
      '//www.googleadservices.com/pagead/conversion/980458791/?label=zEXKCPG8wRIQp7rC0wM&guid=ON',
      '//flex.msn.com/mstag/tag/6c67fdd7-d46f-4282-a17b-79e55dec06a1/analytics.html?dedup=1&domainId=3198458&type=1&actionid=258749',
      'https://www.facebook.com/tr?ev=6016744998878&cd[value]=0.00&cd[currency]=USD'
    ]
};

function EventTracker() {
  this.track = function(data) {
    if (!_.isEmpty(data)) {
      // Use jquery and not angular here so we don't incur the cost
      // of an unnecessary digest on the reply.
      $.get('/event', data);
      if (mixpanel) {
        var mixpanelData = angular.copy(data);
        var eventName = mixpanelData['name'];
        delete mixpanelData['name'];
        mixpanel.track(eventName, mixpanelData);
      }
    }
  };

  this.sendConversion = function(conversionEventName) {
    var trackingUrls = CONVERSION_EVENTS[conversionEventName];
    if (_.isEmpty(trackingUrls)) {
      return;
    }
    $.each(trackingUrls, function(i, url) {
      $('<img width="1" height="1">').attr('src', url);
    });
  };
}

function tcTrackClick($parse, $eventTracker) {
  return {
    link: function(scope, element, attrs) {
      element.on('click', function() {
        var data = $parse(attrs.tcTrackClick)(scope);
        $eventTracker.track(data);
      });
    }
  };
}

function tcTrackMousedown($parse, $eventTracker) {
  return {
    link: function(scope, element, attrs) {
      element.on('mousedown', function() {
        var data = $parse(attrs.tcTrackMousedown)(scope);
        $eventTracker.track(data);
      });
    }
  };
}

angular.module('eventTrackingModule', [])
  .service('$eventTracker', EventTracker)
  .directive('tcTrackClick', tcTrackClick)
  .directive('tcTrackMousedown', tcTrackMousedown);

// End event code
