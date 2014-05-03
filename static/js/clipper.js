function ClipperStateModel(initialStatus) {
  this.status = initialStatus;

  this.inConfirmation = function() {
    return this.status == ClipperState.SUCCESS_CONFIRMATION;
  };
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
}

ClipperEntityModel.getData = function(entityModel) {
  return entityModel.data;
};

function ClipperRootCtrl2($scope, $http, $timeout, $entityService,
    $needsPageSource, $entities, $allTripPlans, $datatypeValues) {
  var me = this;
  $scope.clipperState = new ClipperStateModel();

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
          me.prepareEntityState(response['entity']);
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

function ClipperEntityCtrl($scope) {
  $scope.ed = $scope.entityModel.data;
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

function ClipperEditorCtrl($scope, $timeout) {

  this.makeMarker = function(entityData, map) {
    var latlngJson = entityData['latlng'] || {};
    var latlng = new google.maps.LatLng(
      latlngJson['lat'] || 0.0, latlngJson['lng'] || 0.0);
    return new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/' + entityData['icon_url'],
      map: map
    });
  };

  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 15,
    panControl: false,
    scaleControl: false,
    streetViewControl: false,
    mapTypeControl: false
  };
  var editableMap = new google.maps.Map($('#clipper-editor-map')[0], mapOptions);
  var editableMarker = this.makeMarker($scope.entityModel.data, editableMap);
  google.maps.event.addListener(editableMarker, 'dragend', function() {
    var entityData = $scope.entityModel.data;
    if (!entityData['latlng']) {
      entityData['latlng'] = {};
    }
    entityData['latlng']['lat'] = editableMarker.getPosition().lat();
    entityData['latlng']['lng'] = editableMarker.getPosition().lng();
  });
  $timeout(function() {
    google.maps.event.trigger(editableMap, 'resize');
    editableMap.setCenter(editableMarker.getPosition());    
  });

  $scope.categoryChanged = function() {
    $scope.ed['sub_category'] = null;
    $scope.updateMarkerIcon();
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entityModel.data;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    $scope.entityModel.data['icon_url'] = iconUrl;
    editableMarker.setIcon('/static/img/' + iconUrl)
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
    .controller('CarouselCtrl', ['$scope', CarouselCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .controller('ClipperEditorCtrl', ['$scope', '$timeout', ClipperEditorCtrl])
    .controller('EditImagesCtrl', ['$scope', '$timeout', EditImagesCtrl])
    .directive('tcStartNewTripInput', tcStartNewTripInput);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
