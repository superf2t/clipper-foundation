var ClipperState = {
  SUMMARY: 1,
  EDIT_TRIP_PLAN: 2,
  EDIT_ENTITY: 3
};

function StateModel(selectedTripPlan) {
  this.tripPlan = selectedTripPlan;
  this.entities = [];
  this.tripPlanModel = new TripPlanModel(selectedTripPlan, this.entities);
  this.state = ClipperState.SUMMARY;
}

function InternalClipperRootCtrl($scope, $stateModel, $messageProxy,
    $allTripPlans, $entityService, $window) {
  $scope.s = $stateModel;
  $scope.ClipperState = ClipperState;
  $scope.allTripPlans = $allTripPlans;

  $scope.$watch('s.tripPlan', function(tripPlan) {
    if (!tripPlan) return;
    $stateModel.tripPlanModel = new TripPlanModel(tripPlan, []);
    $entityService.getByTripPlanId(tripPlan['trip_plan_id'])
      .success(function(response) {
        $stateModel.entities = response['entities'];
        $stateModel.tripPlanModel.resetEntities(response['entities']);
      });
  });

  $scope.openEditTripPlan = function() {
    $messageProxy.makeImgSelectActive();
    $stateModel.state = ClipperState.EDIT_TRIP_PLAN;
  };

  $scope.closeEditTripPlan = function() {
    $messageProxy.makeImgSelectInactive();
    $stateModel.state = ClipperState.SUMMARY;
  };
}

function TripPlanPanelCtrl($scope) {

}

function EditTripPlanCtrl($scope, $stateModel, $tripPlanService) {
  $scope.editableTripPlan = angular.copy($stateModel.tripPlan);
  $scope.saving = false;

  $scope.mapState = {map: null};
  $scope.mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 1,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };

  $scope.setupMap = function($map) {
    if (!_.isEmpty($scope.editableTripPlan['location_bounds'])) {
      $map.fitBounds(gmapsBoundsFromJson($scope.editableTripPlan['location_bounds']));
    }
  };

  $scope.addressSelected = function(place) {
    var geometry = place['geometry'];
    var location = geometry && geometry['location'];
    var viewport = geometry && geometry['viewport'];
    var tripPlan = $scope.editableTripPlan;
    tripPlan['location_name'] = place['formatted_address'];
    if (location) {
      tripPlan['location_latlng'] = {
        'lat': location.lat(),
        'lng': location.lng()
      };
    }
    if (viewport) {
      tripPlan['location_bounds'] = {
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
    if (viewport) {
      $scope.mapState.map.fitBounds(gmapsBoundsFromJson(tripPlan['location_bounds']));
    } else if (location) {
      $scope.mapState.map.setCenter(gmapsLatLngFromJson(tripPlan['location_latlng']));
    }
  };

  $scope.saveTripPlan = function() {
    $scope.saving = true;
    $tripPlanService.editTripPlan($scope.editableTripPlan)
      .success(function(response) {
        _.extend($stateModel.tripPlan, response['trip_plans'][0]);
        $stateModel.state = ClipperState.SUMMARY;
        $scope.saving = false;
      });
  };

  $scope.$on('img-selected', function(event, imgUrl) {
    if (!$stateModel.state == ClipperState.EDIT_TRIP_PLAN) return;
    if (imgUrl) {
      $scope.editableTripPlan['cover_image_url'] = imgUrl;
    }
  });
}

function EditEntityCtrl($scope) {

}

function MessageProxy($window, $rootScope) {
  this.makeImgSelectActive = function() {
    this.sendMessage('tc-img-select-active');
  };

  this.makeImgSelectInactive = function() {
    this.sendMessage('tc-img-select-inactive');
  };

  this.sendMessage = function(messageName, data) {
    var message = _.extend({message: messageName}, data);
    $window.parent.postMessage(message, '*');
  };

  this.handleIncomingMessage = function(messageName, data) {
    if (messageName == 'tc-img-selected') {
      $rootScope.$broadcast('img-selected', data['imgUrl']);
    }
  };

  var me = this;
  $($window).on('message', function(event) {
    var data = event.originalEvent.data;
    var messageName = data['message'];
    me.handleIncomingMessage(messageName, data);
    $rootScope.$apply();
  });
}

function tcEntityListing() {
  return {
    restrict: 'AE',
    templateUrl: 'one-entity-listing-template',
    scope: {
      entity: '='
    },
    controller: function($scope) {
      $scope.ed = $scope.entity;
      $scope.im = new ItemModel($scope.entity);
    }
  };
}

window['initClipper'] = function(allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues)
    .value('$stateModel', new StateModel(allTripPlans[0]));

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('InternalClipperRootCtrl', InternalClipperRootCtrl)
    .controller('TripPlanPanelCtrl', TripPlanPanelCtrl)
    .controller('EditTripPlanCtrl', EditTripPlanCtrl)
    .controller('EditEntityCtrl', EditEntityCtrl)
    .service('$messageProxy', MessageProxy)
    .directive('tcEntityListing', tcEntityListing);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};