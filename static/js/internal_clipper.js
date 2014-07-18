// TODOs:
// -Show source url when editing trip plan settings.
// -If there is no scraper for an article, create a default trip plan
//  and fill in the source url and make a best effort on the title and location.
// -Get extra structure data from Google entity converter
// -Add tags to entity editor and trip plan editor

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

var DEFAULT_SHORTCUT_KEYS = 'n: new place, e: edit trip plan';
var TRIP_PLAN_SHORTCUT_KEYS = '1: name, 2: location, 3: description<br/>s: save, x: cancel';
var ENTITY_SHORTCUT_KEYS = '1: name, 2: addr, 3: desc, 4: phone, 5: website, 6 hours<br/>s: save, x: cancel';

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
    $messageProxy.setStatusMessage(null);
    $messageProxy.setShortcutMessage(DEFAULT_SHORTCUT_KEYS);
  };

  $scope.openEditEntity = function(entity) {
    $messageProxy.makeImgSelectActive();
    $stateModel.state = ClipperState.EDIT_ENTITY;
    $stateModel.editableEntity = angular.copy(entity);
  }

  $scope.closeEditEntity = function() {
    $messageProxy.makeImgSelectInactive();
    $stateModel.state = ClipperState.SUMMARY;
    $stateModel.editableEntity = null;
    $messageProxy.setStatusMessage(null);
    $messageProxy.setShortcutMessage(DEFAULT_SHORTCUT_KEYS);
  };

  $scope.createNewEntity = function() {
    $scope.openEditEntity({});
  };

  $scope.$on('shortcut-keypress', function(event, keyCode) {
    if (!$stateModel.state == ClipperState.SUMMARY) return;
    var key = String.fromCharCode(keyCode);
    if (key == 'E') {
      $scope.openEditTripPlan();
    } else if (key == 'N') {
      $scope.createNewEntity();
    }
  });

  $messageProxy.setShortcutMessage(DEFAULT_SHORTCUT_KEYS);
}

function EditTripPlanCtrl($scope, $stateModel, $tripPlanService, $messageProxy) {
  $scope.editableTripPlan = angular.copy($stateModel.tripPlan);
  $scope.saving = false;

  // Highlighting text in the page will store to this field.
  $scope.activeFieldName = null;

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
        $scope.saving = false;
        $scope.closeEditTripPlan();
      });
  };

  $scope.setActiveField = function(fieldName) {
    $scope.activeFieldName = fieldName;
    if (fieldName) {
      $messageProxy.setStatusMessage('Highlight to select ' + fieldName);
    } else {
      $messageProxy.setStatusMessage(null);
    }
  };

  $scope.$on('img-selected', function(event, imgUrl) {
    if (!$stateModel.state == ClipperState.EDIT_TRIP_PLAN) return;
    if (imgUrl) {
      $scope.editableTripPlan['cover_image_url'] = imgUrl;
    }
  });

  $scope.$on('shortcut-keypress', function(event, keyCode) {
    if (!$stateModel.state == ClipperState.EDIT_TRIP_PLAN) return;
    var key = String.fromCharCode(keyCode);
    if (key == '1') {
      $scope.setActiveField('name');
    } else if (key == '2') {
      $scope.setActiveField('description');
    } else if (key == '3') {
      $scope.setActiveField('location_name');
    } else if (key == 'S') {
      $scope.saveTripPlan();
    } else if (key == 'X') {
      $scope.closeEditTripPlan()
    } else {
      $scope.activeFieldName = null;
    }
  });

  $scope.$on('text-selected', function(event, text) {
    if (!$stateModel.state == ClipperState.EDIT_TRIP_PLAN) return;
    if (!text || !$scope.activeFieldName) return;
    $scope.editableTripPlan[$scope.activeFieldName] = text;
  });

  $messageProxy.setShortcutMessage(TRIP_PLAN_SHORTCUT_KEYS);
}

function EditEntityCtrl($scope, $stateModel, $entityService, $taxonomy, $messageProxy) {
  $scope.ed = $stateModel.editableEntity;
  $scope.em = new EntityModel($stateModel.editableEntity);
  $scope.saving = false;

  $scope.categories = $taxonomy.allCategories();
  $scope.getSubCategories = function(categoryId) {
    return $taxonomy.getSubCategoriesForCategory(categoryId);
  };

  // Highlighting text in the page will store to this field.
  $scope.activeFieldName = null;

  $scope.mapState = {map: null};
  var mapCenter = $scope.em.hasLocation() ? $scope.em.gmapsLatLng() : new google.maps.LatLng(0, 0);
  $scope.mapOptions = {
    center: mapCenter,
    zoom: $scope.em.hasLocation() ? 15 : 1,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };

  $scope.setupMap = function($map) {
    var marker = new google.maps.Marker({
      position: mapCenter,
      map: $map,
      draggable: true
    });
    google.maps.event.addListener(marker, 'dragend', function() {
      if (!$scope.ed['latlng']) {
        $scope.ed['latlng'] = {};
      }
      var position = marker.getPosition();
      $scope.ed['latlng']['lat'] = position.lat();
      $scope.ed['latlng']['lng'] = position.lng();
    });
  };

  $scope.saveEntity = function() {
    if ($scope.ed['entity_id']) {
      $scope.saveExistingEntity();
    } else {
      $scope.saveNewEntity();
    }
  };

  $scope.saveExistingEntity = function() {
    $scope.saving = true;
    $entityService.editEntity($scope.ed, $stateModel.tripPlan['trip_plan_id'])
      .success(function(response) {
        var entity = response['entities'][0];
        $.each($stateModel.entities, function(i, existingEntity) {
          if (existingEntity['entity_id'] == entity['entity_id']) {
            _.extend(existingEntity, entity);
          }
        });
        $stateModel.tripPlanModel.updateEntities(response['entities']);
        $scope.saving = false;
        $scope.closeEditEntity()
      });
  };

  $scope.saveNewEntity = function() {
    $scope.saving = true;
    $entityService.saveNewEntity($scope.ed, $stateModel.tripPlan['trip_plan_id'])
      .success(function(response) {
        var entity = response['entities'][0];
        // Right now this is handled by the TripPlanModel, but if we remove
        // the use of the model we'll need to put this line back.
        // $stateModel.entities.push(entity);
        $stateModel.tripPlanModel.addNewEntities(response['entities']);
        $scope.saving = false;
        $scope.closeEditEntity()
      });
  };

  $scope.setActiveField = function(fieldName) {
    $scope.activeFieldName = fieldName;
    if (fieldName) {
      $messageProxy.setStatusMessage('Highlight to select ' + fieldName);
    } else {
      $messageProxy.setStatusMessage(null);
    }
  };

  $scope.$on('shortcut-keypress', function(event, keyCode) {
    if (!$stateModel.state == ClipperState.EDIT_ENTITY) return;
    var key = String.fromCharCode(keyCode);
    if (key == '1') {
      $scope.setActiveField('name');
    } else if (key == '2') {
      $scope.setActiveField('address');
    } else if (key == '3') {
      $scope.setActiveField('description');
    } else if (key == '4') {
      $scope.setActiveField('phone_number');
    } else if (key == '5') {
      $scope.setActiveField('website');
    } else if (key == '6') {
      $scope.setActiveField('opening_hours');
    } else if (key == 'S') {
      $scope.saveEntity();
    } else if (key == 'X') {
      $scope.closeEditEntity()
    } else {
      $scope.activeFieldName = null;
    }
  });

  $scope.$on('text-selected', function(event, text) {
    if (!$stateModel.state == ClipperState.EDIT_ENTITY) return;
    if (!text || !$scope.activeFieldName) return;
    $scope.ed[$scope.activeFieldName] = text;
  });

  $messageProxy.setShortcutMessage(ENTITY_SHORTCUT_KEYS);
}

function ClipperEntityPhotoCtrl($scope, $stateModel) {
  if (_.isEmpty($scope.ed['photo_urls'])) {
    $scope.ed['photo_urls'] = [];
  }
  var urls = $scope.ed['photo_urls'];
  var selectedImgIndex = urls.length ? 0 : null;

  $scope.selectedImg = function() {
    return urls[selectedImgIndex];
  };

  $scope.hasImgs = function() {
    return urls.length > 0;
  };

  $scope.hasPrevImg = function() {
    return selectedImgIndex > 0;
  };

  $scope.hasNextImg = function() {
    return selectedImgIndex < (urls.length - 1);
  };

  $scope.prevImg = function() {
    selectedImgIndex--;
  };

  $scope.nextImg = function() {
    if ($scope.hasNextImg()) {
      selectedImgIndex++;      
    }
  };

  $scope.setAsPrimary = function() {
    var url = urls.splice(selectedImgIndex, 1)[0];
    urls.splice(0, 0, url);
    selectedImgIndex = 0;
  };

  $scope.deletePhoto = function() {
    urls.splice(selectedImgIndex, 1);
    if (selectedImgIndex > 0 && selectedImgIndex > (urls.length - 1)) {
      selectedImgIndex--;
    }
  };

  $scope.$on('img-selected', function(event, imgUrl) {
    if ($stateModel.state != ClipperState.EDIT_ENTITY || !imgUrl) return;
    urls.push(imgUrl);
    selectedImgIndex = urls.length - 1;
  });
}

function MessageProxy($window, $rootScope) {
  this.makeImgSelectActive = function() {
    this.sendMessage('tc-img-select-active');
  };

  this.makeImgSelectInactive = function() {
    this.sendMessage('tc-img-select-inactive');
  };

  this.setStatusMessage = function(msg) {
    this.sendMessage('tc-set-clip-status-message', {'clipStatusMessage': msg});
  };

  this.setShortcutMessage = function(msg) {
    this.sendMessage('tc-set-clip-shortcut-message', {'clipShortcutMessage': msg});
  };

  this.sendMessage = function(messageName, data) {
    var message = _.extend({message: messageName}, data);
    $window.parent.postMessage(message, '*');
  };

  this.handleIncomingMessage = function(messageName, data) {
    if (messageName == 'tc-img-selected') {
      $rootScope.$broadcast('img-selected', data['imgUrl']);
    } else if (messageName == 'tc-keyup') {
      $rootScope.$broadcast('shortcut-keypress', data['keyCode']);
    } else if (messageName == 'tc-text-selected') {
      $rootScope.$broadcast('text-selected', data['selection']);
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
    .value('$taxonomy', new TaxonomyTree(datatypeValues['categories'], datatypeValues['sub_categories']))
    .value('$stateModel', new StateModel(allTripPlans[0]));

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('InternalClipperRootCtrl', InternalClipperRootCtrl)
    .controller('EditTripPlanCtrl', EditTripPlanCtrl)
    .controller('EditEntityCtrl', EditEntityCtrl)
    .controller('ClipperEntityPhotoCtrl', ClipperEntityPhotoCtrl)
    .service('$messageProxy', MessageProxy)
    .directive('tcEntityListing', tcEntityListing);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
