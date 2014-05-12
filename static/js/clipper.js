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

// TODO: Remove this and just use EntityModel
function ClipperEntityModel(entityData, opt_selected) {
  this.data = entityData;
  this.data.selected = opt_selected;

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

function ClipperRootCtrl($scope, $window, $http, $timeout, $entityService,
    $needsPageSource, $entities, $allTripPlans, $datatypeValues) {
  var me = this;
  $scope.clipperState = new ClipperStateModel();
  $scope.ClipperState = ClipperState;

  // Dummy counter to increment when models have changed
  // in a way that may affect the amount of content displayed
  // in the UI, so that directives can listen for changes.
  $scope.displayState = {dirtyCounter: 0};

  this.setupEntityState = function(entities) {
    $scope.entityModels = _.map(entities, function(entity) {
      return new ClipperEntityModel(entity, true);
    });
    if (entities.length) {
      $scope.clipperState.status = ClipperState.SUMMARY;
    } else {
      $scope.clipperState.status = ClipperState.NO_AUTO_PLACE_FOUND;
    }
    $scope.displayState.dirtyCounter++;
  };

  $scope.selectedTripPlanState = {
    tripPlan: null,
    bounds: function() {
      if ($scope.selectedTripPlanState.tripPlan
        && !_.isEmpty($scope.selectedTripPlanState.tripPlan['location_bounds'])) {
        return gmapsBoundsFromJson($scope.selectedTripPlanState.tripPlan['location_bounds']);
      }
      return null;
    }
  };

  if ($needsPageSource) {
    $($window).on('message', function(event) {
      if (!event.originalEvent.data['message'] == 'tc-page-source') {
        return;
      }
      var pageSource = event.originalEvent.data['data'];
      $entityService.pagesourcetoentities(getParameterByName('url'), pageSource)
        .success(function(response) {
          me.setupEntityState(response['entities']);
        });
    });
    $window.parent.postMessage('tc-needs-page-source', '*'); 
    $scope.clipperState = new ClipperStateModel(ClipperState.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE);
  } else {
    this.setupEntityState($entities);
  }

  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];

  $scope.addEntity = function(entityData) {
    $scope.entityModels.push(new ClipperEntityModel(entityData, true));
    $scope.clipperState.status = ClipperState.SUMMARY;
    $scope.displayState.dirtyCounter++;
  };

  $scope.startManualEntry = function() {
    var entityData = {
      'icon_url': 'sight-2.png',
      'source_url': getParameterByName('url')
    };
    $scope.addEntity(entityData);
  };

  $scope.selectedEntities = function() {
    var selectedEntityModels = _.filter($scope.entityModels, function(entityModel) {
      return entityModel.data.selected;
    });
    return _.map(selectedEntityModels, ClipperEntityModel.getData);
  };

  $scope.saveButtonEnabled = function() {
    var selectedEntities = $scope.selectedEntities();
    if (!selectedEntities.length) {
      return false;
    }
    var entitiesWithNames = _.filter(selectedEntities, function(entity) {
      return !!entity['name'];
    });
    if (entitiesWithNames.length == 0 || selectedEntities.length != entitiesWithNames.length) {
      return false;
    }
    return $scope.selectedTripPlanState.tripPlan
      && $scope.selectedTripPlanState.tripPlan['trip_plan_id'] > 0;
  };

  $scope.saveEntities = function() {
    var entitiesToSave = $scope.selectedEntities();
    $entityService.saveNewEntities(entitiesToSave, $scope.selectedTripPlanState.tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.clipperState.status = ClipperState.SUCCESS_CONFIRMATION;
          $scope.savedEntities = entitiesToSave;
          $timeout($scope.dismissClipper, 3000);
        } else {
          $scope.clipperState.status = ClipperState.CLIP_ERROR;
        }
      }).error(function(response) {
       $scope.clipperState.status = ClipperState.CLIP_ERROR;
      });
  };

  $scope.allEntitiesSelected = function() {
    return $scope.entityModels.length == $scope.selectedEntities().length;
  };

  $scope.toggleSelectAll = function() {
    var newSelectedState = !$scope.allEntitiesSelected()
    $.each($scope.entityModels, function(i, entityModel) {
      entityModel.data.selected = newSelectedState;
    });
  };

  $scope.dismissClipper = function() {
    $window.parent.postMessage('tc-close-clipper', '*');
  };
}

function ClipperOmniboxCtrl($scope, $entityService) {
  var me = this;
  $scope.loadingData = false;
  $scope.rawInputText = '';
  $scope.searchResults = null;

  $scope.placeChanged = function(newPlace) {
    if (!newPlace) {
      return;
    }
    if (!newPlace['reference']) {
      me.searchForPlace(newPlace['name']);
    } else {
      me.loadEntityByGooglePlaceReference(newPlace['reference']);      
    }
  };

  this.loadEntityByGooglePlaceReference = function(reference) {
    $scope.loadingData = true;
    $entityService.googleplacetoentity(reference)
      .success(function(response) {
        var entity = response['entity'];
        var sourceUrl = getParameterByName('url');
        entity['source_url'] = sourceUrl;
        $scope.loadingData = false;
        $scope.rawInputText = '';
        // This is defined on the parent scope, not ideal.
        $scope.addEntity(entity);
      }).error(function() {
        $scope.loadingData = false;
      });
  };

  this.searchForPlace = function(query) {
    $scope.loadingData = true;
    var request = {
      query: query,
      bounds: $scope.selectedTripPlanState.bounds()
    };
    console.log(request);
    var dummyMap = new google.maps.Map($('<div>')[0], {
      center: new google.maps.LatLng(0, 0)
    });
    var searchService = new google.maps.places.PlacesService(dummyMap);
    searchService.textSearch(request, function(results, status) {
      $scope.$apply(function() {
        $scope.loadingData = false;
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          $scope.searchResults = results;
        }
      });
    });
  };

  $scope.selectResult = function(result) {
    $scope.searchResults = null;
    me.loadEntityByGooglePlaceReference(result['reference']);
  };
}

window['initClipper'] = function(entities, needsPageSource,
    allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$entities', entities)
    .value('$needsPageSource', needsPageSource)
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues);

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'entityResultModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('ClipperRootCtrl', ['$scope', '$window', '$http', '$timeout', '$entityService',
      '$needsPageSource', '$entities', '$allTripPlans', '$datatypeValues', ClipperRootCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .directive('tcStartNewTripInput', tcStartNewTripInput);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
