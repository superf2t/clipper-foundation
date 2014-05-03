function ClipperStateModel(initialStatus) {
  this.status = initialStatus;
}

var ClipperState = {
  SUMMARY: 1,
  EDIT: 2,
  SUCCESS_CONFIRMATION: 3,
  NO_AUTO_PLACE_FOUND: 4,
  CLIP_ERROR: 5,
  WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE: 6
};

function ClipperEntityModel(entityData, opt_selected) {
  this.data = entityData;
  this.selected = opt_selected;

  this.hasLocation = function() {
    return !_.isEmpty(this.data['latlng']);
  };

  this.gmapsLatLng = function() {
    return gmapsLatLngFromJson(this.data['latlng']);
  };
}

ClipperEntityModel.getData = function(entityModel) {
  return entityModel.data;
};

function ClipperRootCtrl2($scope, $http, $timeout, $entityService,
    $needsPageSource, $entities, $allTripPlans, $datatypeValues) {
  var me = this;
  $scope.clipperState = new ClipperStateModel();

  $scope.ClipperState = ClipperState;

  this.setupEntityState = function(entities) {
    $scope.entityModels = _.map(entities, function(entity) {
      return new ClipperEntityModel(entity, true);
    });
    if (entities.length) {
      $scope.clipperState.status = ClipperState.SUMMARY;
    } else {
      $scope.clipperState.status = ClipperState.NO_AUTO_PLACE_FOUND;
    }
  };

  $scope.selectedTripPlanState = {
    tripPlan: null
  };

  if ($needsPageSource) {
    $(window).on('message', function(event) {
      if (!event.originalEvent.data['message'] == 'tc-page-source') {
        return;
      }
      var pageSource = event.originalEvent.data['data'];
      $entityService.pagesourcetoentity(getParameterByName('url'), pageSource)
        .success(function(response) {
          me.setupEntityState([response['entity']]);
        });
    });
    window.parent.postMessage('tc-needs-page-source', '*'); 
    $scope.clipperState = new ClipperStateModel(ClipperState.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE);
  } else {
    this.setupEntityState($entities);
  }

  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];

  $(window).on('message', function(event) {
    $scope.$apply(function(){
      if (event.originalEvent.data['message'] == 'tc-image-dropped') {
        $scope.$broadcast('image-dropped', event.originalEvent.data['data']);
      }
    });
  });

  this.selectedEntityModels = function() {
    return _.filter($scope.entityModels, function(entityModel) {
      return entityModel.selected;
    });
  };

  this.selectedEntities = function() {
    return _.map(this.selectedEntityModels(), ClipperEntityModel.getData);
  };

  $scope.showSaveControls = function() {
    return me.selectedEntityModels().length
      && $scope.selectedTripPlanState.tripPlan
      && $scope.selectedTripPlanState.tripPlan['trip_plan_id'] > 0;
  };

  $scope.saveEntities = function() {
    $entityService.saveNewEntities(me.selectedEntities(), $scope.selectedTripPlanState.tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.clipperState.status = ClipperState.SUCCESS_CONFIRMATION;
          $timeout($scope.dismissClipper, 3000);
        } else {
          $scope.clipperState.status = ClipperState.CLIP_ERROR;
        }
      }).error(function(response) {
       $scope.clipperState.status = ClipperState.CLIP_ERROR;
      });
  };

  $scope.openEditor = function() {
    $scope.clipperState.status = ClipperState.EDIT;
  };

  $scope.openEditorWithEntity = function(entityData) {
    $scope.entityModel = new EntityModel(entityData);
    $scope.ed = entityData;
    $scope.openEditor();
  };

  $scope.dismissClipper = function() {
    window.parent.postMessage('tc-close-clipper', '*');
  };
}

var ClipperEntityState = {
  NOT_EDITING: 1,
  EDITING_NOTE: 2,
  EDITING_PHOTOS: 3,
  EDITING_LOCATION: 4
};

function ClipperEntityCtrl($scope) {
  var me = this;
  $scope.ed = $scope.entityModel.data;
  $scope.state = ClipperEntityState.NOT_EDITING;
  $scope.ClipperEntityState = ClipperEntityState;

  this.createMarker = function(latlng, opt_map) {
    var marker = new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/' + $scope.ed['icon_url'],
      map: opt_map
    });
    google.maps.event.addListener(marker, 'dragend', function() {
      var entityData = $scope.ed;
      if (_.isEmpty(entityData['latlng'])) {
        entityData['latlng'] = {};
      }
      entityData['latlng']['lat'] = marker.getPosition().lat();
      entityData['latlng']['lng'] = marker.getPosition().lng();
    });
    return marker;
  };

  $scope.map = null;
  var center = $scope.entityModel.hasLocation()
    ? $scope.entityModel.gmapsLatLng()
    : new google.maps.LatLng(0, 0);
  var marker = this.createMarker(center);
  $scope.mapOptions = {
    center: center,
    zoom: $scope.entityModel.hasLocation() ? 15 : 2,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };

  $scope.setupMap = function($map) {
    marker.setMap($map);
  };

  $scope.editing = function() {
    return $scope.state != ClipperEntityState.NOT_EDITING;
  };

  $scope.closeEditor = function() {
    $scope.state = ClipperEntityState.NOT_EDITING;
  };

  $scope.openEditNote = function() {
    $scope.state = ClipperEntityState.EDITING_NOTE;
  };

  $scope.openEditLocation = function() {
    $scope.state = ClipperEntityState.EDITING_LOCATION;
  };

  $scope.openEditPhotos = function() {
    $scope.state = ClipperEntityState.EDITING_PHOTOS;
  };

  $scope.addressSelected = function(place) {
    if (place['formatted_address']) {
      // ng-model is set to ed['address'] but the place
      // change event fires before the model gets updated
      $scope.ed['address'] = place['formatted_address'];
    }
    if (place['geometry']) {
      var location = place['geometry']['location'];
      $scope.ed['latlng']['lat'] = location.lat();
      $scope.ed['latlng']['lng'] = location.lng();
      $scope.map.setCenter(location);
      marker.setPosition(location);
      if (place['geometry']['viewport']) {
        $scope.map.fitBounds(place['geometry']['viewport']);
      }
    }
  };
}

function ClipperOmniboxCtrl($scope, $entityService) {
  var me = this;
  $scope.loadingData = false;
  $scope.entityNotFound = false;
  $scope.rawInputText = '';

  $scope.placeChanged = function(newPlace) {
    if (!newPlace || !newPlace['reference']) {
      return;
    }
    me.loadEntityByGooglePlaceReference(newPlace['reference']);
  };

  $scope.openEditManually = function() {
    // This is a method defined on the parent scope, not ideal.    
    $scope.openEditor();
  };

  this.loadEntityByGooglePlaceReference = function(reference) {
    $scope.loadingData = true;
    $entityService.googleplacetoentity(reference)
      .success(function(response) {
        var entity = response['entity'];
        if (entity) {
          var sourceUrl = getParameterByName('url');
          entity['source_url'] = sourceUrl;
          // This is a method defined on the parent scope, not ideal.
          $scope.openEditorWithEntity(entity);
        } else {
          $scope.entityNotFound = true;
        }
        $scope.loadingData = false;
        $scope.rawInputText = '';
      });
  };
}

window['initClipper2'] = function(entities, needsPageSource,
    allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$entities', entities)
    .value('$needsPageSource', needsPageSource)
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues);

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('ClipperRootCtrl2', ['$scope', '$http', '$timeout', '$entityService',
      '$needsPageSource', '$entities', '$allTripPlans', '$datatypeValues', ClipperRootCtrl2])
    .controller('ClipperEntityCtrl', ['$scope', ClipperEntityCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .directive('tcStartNewTripInput', tcStartNewTripInput);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
