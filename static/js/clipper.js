var ClipperState = {
  SUMMARY: 1,
  EDIT: 2,
  SUCCESS_CONFIRMATION: 3,
  SEARCH: 4,
  CLIP_ERROR: 5,
  WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE: 6
};

function TripPlanState(opt_tripPlan, opt_entities) {
  this.tripPlan = opt_tripPlan;
  this.entities = opt_entities;

  this.bounds = function() {
    if (this.tripPlan && !_.isEmpty(this.tripPlan['location_bounds'])) {
      return gmapsBoundsFromJson(this.tripPlan['location_bounds']);
    }
    return null;
  };
}

function ClipperStateModel() {
  this.selectedEntityId = null;
  this.highlightedEntityId = null;
  this.selectedResultIndex = null;
  this.highlightedResultIndex = null;
  this.resultIndicesToSave = [];
}

function ClipperRootCtrl($scope, $clipperStateModel, $window) {

  $scope.clipperStateModel = $clipperStateModel;

  // TODO: Figure out if this is still needed.
  // Dummy counter to increment when models have changed
  // in a way that may affect the amount of content displayed
  // in the UI, so that directives can listen for changes.
  $scope.displayState = {dirtyCounter: 0};

  $scope.closeAllEditors = function() {
    $scope.$broadcast('closealleditors');
  };

  $scope.dismissClipper = function() {
    $window.parent.postMessage('tc-close-clipper', '*');
  };
}

function ClipperPanelCtrl($scope, $clipperStateModel, $tripPlanState, $entityService, $mapProxy,
    $datatypeValues, $window, $timeout) {
  var me = this;

  $scope.entities = [];
  $scope.clipperState = {
    status: ClipperState.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE
  };
  $scope.ClipperState = ClipperState;
  $scope.tripPlanState = $tripPlanState;

  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];

  var remoteChangeInProgress = false;

  $scope.$watch(_.constant($clipperStateModel), function(value) {
    if (remoteChangeInProgress) {
      remoteChangeInProgress = false;
    } else {
      $mapProxy.clipperStateChanged(value);
    }
  }, true);

  $scope.$watch('entities', function(entities, oldEntities) {
    if (!oldEntities || entities.length == oldEntities.length) {
      return;
    }
    $mapProxy.plotResultEntities(entities);
  }, true);

  this.setupEntityState = function(entities) {
    $scope.entities = entities;
    if (entities.length == 1) {
      $scope.entities[0].selected = true;
      $clipperStateModel.resultIndicesToSave[0] = true;
    }
    if (entities.length) {
      $scope.clipperState.status = ClipperState.SUMMARY;
    } else {
      $scope.clipperState.status = ClipperState.SEARCH;
    }
    $scope.displayState.dirtyCounter++;
  };

  $scope.addEntity = function(entityData) {
    $scope.entities.push(entityData);
    entityData.selected = true;
    $clipperStateModel.resultIndicesToSave[$scope.entities.length - 1] = true;
    $scope.clipperState.status = ClipperState.SUMMARY;
    $scope.displayState.dirtyCounter++;
  };

  $scope.startManualEntry = function() {
    var entityData = {
      'source_url': getParameterByName('url'),
      'latlng': $tripPlanState.tripPlan ? $tripPlanState.tripPlan['location_latlng'] : {'lat': 0, 'lng': 0}
    };
    $scope.addEntity(entityData);
  };

  $scope.openAddOther = function() {
    $scope.clipperState.status = ClipperState.SEARCH;
  };

  $scope.selectedEntities = function() {
    return _.filter($scope.entities, function(entity) {
      return entity.selected;
    });
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
    return $tripPlanState.tripPlan
      && $tripPlanState.tripPlan['trip_plan_id'] > 0;
  };

  $scope.saveEntities = function() {
    var entitiesToSave = $scope.selectedEntities();
    $entityService.saveNewEntities(entitiesToSave, $tripPlanState.tripPlan['trip_plan_id'])
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
    return $scope.entities.length == $scope.selectedEntities().length;
  };

  $scope.selectAll = function() {
    $.each($scope.entities, function(i, entity) {
      entity.selected = true;
      $clipperStateModel.resultIndicesToSave[i] = true;
    });
  };

  $scope.deselectAll = function() {
    $.each($scope.entities, function(i, entity) {
      entity.selected = false;
      $clipperStateModel.resultIndicesToSave[i] = false;
    });
  };

  $($window).on('message', function(event) {
    var data = event.originalEvent.data;
    var messageName = data['message'];
    if (messageName == 'tc-page-source') {
      var pageSource = data['pageSource'];
      if (!pageSource) {
        // This is really weird, the tc-page-source message is being received
        // twice, despite it only being sent once by the parent frame.
        // The duplicate message is missing the page source, so just discard it here.
        return;
      }
      $entityService.pagesourcetoentities(getParameterByName('url'), pageSource)
        .success(function(response) {
          me.setupEntityState(response['entities']);
        });
    } else if (messageName == 'tc-map-to-clipper-state-changed') {
      remoteChangeInProgress = true;
      _.extend($clipperStateModel, data['clipperStateModel']);
      $scope.$apply();
    } else if (messageName == 'tc-map-to-clipper-result-marker-dragged') {
      var entity = $scope.entities[data['resultIndex']];
      entity['latlng'] = data['entity']['latlng'];
      entity['address_precision'] = data['entity']['address_precision'];
      $scope.$apply();
    };
  });

  $window.parent.postMessage('tc-needs-page-source', '*'); 
}

function TripPlanPanelCtrl($scope, $clipperStateModel, $tripPlanState, $mapProxy,
    $tripPlanService, $entityService) {
  $scope.tripPlanState = $tripPlanState;
  $scope.$watch('tripPlanState.tripPlan', function(tripPlan) {
    if (!tripPlan) {
      return;
    }
    $scope.tripPlanState.entities = null;
    $scope.loadingEntities = true;
    $entityService.getByTripPlanId(tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.loadingEntities = false;
          $scope.tripPlanState.entities = response['entities'];
          $mapProxy.plotTripPlanEntities(response['entities']);
        }
      });
  });
}

function ClipperTripPlanEntityCtrl($scope, $clipperStateModel) {
  $scope.ed = $scope.entity;

  $scope.selectEntity = function() {
    $clipperStateModel.selectedEntityId = $scope.ed['entity_id'];
  };

  $scope.isSelected = function() {
    return $scope.ed['entity_id'] == $clipperStateModel.selectedEntityId;
  };

  $scope.highlightEntity = function() {
    $clipperStateModel.highlightedEntityId = $scope.ed['entity_id'];
  };

  $scope.unhighlightEntity = function() {
    $clipperStateModel.highlightedEntityId = null;
  };
}

function MapProxy($window) {
  var me = this;

  this.plotTripPlanEntities = function(entities) {
    this.sendMessage('tc-clipper-to-map-plot-trip-plan-entities', {entities: entities});
  };

  this.plotResultEntities = function(entities) {
    this.sendMessage('tc-clipper-to-map-plot-result-entities', {entities: entities});
  };

  this.resultAddressChanged = function(resultIndex, entity, opt_viewport) {
    this.sendMessage('tc-clipper-to-map-result-address-changed', {
      resultIndex: resultIndex,
      entity: entity,
      viewport: opt_viewport
    });
  };

  this.resultMarkerSetDraggable = function(resultIndex, draggable) {
    this.sendMessage('tc-clipper-to-map-result-marker-set-draggable', {
      resultIndex: resultIndex,
      draggable: draggable
    });
  };

  this.clipperStateChanged = function(clipperStateModel) {
    this.sendMessage('tc-clipper-to-map-state-changed', {clipperStateModel: clipperStateModel});
  };

  this.sendMessage = function(messageName, data) {
    var message = _.extend({message: messageName}, data);
    $window.parent.postMessage(message, '*');
  };

  this.sendMessage('tc-clipper-ready');
}

function ClipperOmniboxCtrl($scope, $tripPlanState, $entityService) {
  var me = this;
  $scope.loadingData = false;
  $scope.rawInputText = '';
  $scope.searchResults = null;
  $scope.searchComplete = false;
  $scope.tripPlanState = $tripPlanState;
  $scope.ready = true;

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
    $scope.searchComplete = false;
    $scope.searchResults = null;
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
    $scope.searchResults = null;
    $scope.searchComplete = false;
    var request = {
      query: query,
      bounds: $tripPlanState.bounds()
    };
    var dummyMap = new google.maps.Map($('<div>')[0], {
      center: new google.maps.LatLng(0, 0)
    });
    var searchService = new google.maps.places.PlacesService(dummyMap);
    searchService.textSearch(request, function(results, status) {
      $scope.$apply(function() {
        $scope.loadingData = false;
        $scope.searchComplete = true;
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

function ClipperResultEntityCtrl($scope, $clipperStateModel, $mapProxy, $window) {
  var me = this;
  $scope.ed = $scope.entity;
  $scope.em = new EntityModel($scope.ed);
  $scope.im = new ItemModel($scope.ed);

  $scope.editNotesState = {active: false};
  $scope.editPhotosState = {active: false};
  $scope.editLocationState = {active: !$scope.ed['name']};
  var editorStates = [$scope.editNotesState, $scope.editPhotosState, $scope.editLocationState];
  if ($scope.editLocationState.active) {
    $mapProxy.resultMarkerSetDraggable($scope.$index, true);
  }

  $scope.toggleSelectResultForSaving = function() {
    if ($scope.entities.length == 1) {
      return;
    }
    $scope.ed.selected = !$scope.ed.selected;
    $clipperStateModel.resultIndicesToSave[$scope.$index] = $scope.ed.selected;
  };

  $scope.selectResult = function() {
    $clipperStateModel.selectedResultIndex = $scope.$index;
  };

  $scope.highlightResult = function() {
    $clipperStateModel.highlightedResultIndex = $scope.$index;
  };

  $scope.unhighlightResult = function() {
    $clipperStateModel.highlightedResultIndex = null;
  };

  $scope.resultLetter = function() {
    return String.fromCharCode(65 + $scope.$index);
  };

  $scope.isSelected = function() {
    return $clipperStateModel.selectedResultIndex == $scope.$index;
  };

  $scope.isSelectedForSaving = function() {
    return !!$clipperStateModel.resultIndicesToSave[$scope.$index];
  };

  $scope.isEditing = function() {
    return _.some(editorStates, function(state) {
      return state.active;
    });
  };

  $scope.startEditingPhotos = function() {
    $window.parent.postMessage('tc-photo-editing-active', '*');
  };

  $scope.stopEditingPhotos = function() {
    $window.parent.postMessage('tc-photo-editing-inactive', '*');
  };

  $scope.openEditor = function() {
    $scope.editNotesState.active = true;
    $mapProxy.resultMarkerSetDraggable($scope.$index, true);
  };

  $scope.closeEditor = function() {
    $scope.stopEditingPhotos();
    _.each(editorStates, function(state) {state.active = false});
   $mapProxy.resultMarkerSetDraggable($scope.$index, false);
  };

  $scope.$on('closealleditors', function() {
    $scope.closeEditor();
  });

  $scope.addressSelected = function(place) {
    if (place['formatted_address']) {
      // ng-model is set to ed['address'] but the place
      // change event fires before the model gets updated
      $scope.ed['address'] = place['formatted_address'];
    }
    if (place['geometry']) {
      if (_.isEmpty($scope.ed['latlng'])) {
        $scope.ed['latlng'] = {};
      }
      var location = place['geometry']['location'];
      $scope.ed['latlng']['lat'] = location.lat();
      $scope.ed['latlng']['lng'] = location.lng();
      $scope.ed['address_precision'] = 'Precise';

      var viewport = place['geometry']['viewport'] && boundsJsonFromGmapsBounds(place['geometry']['viewport']);
      $mapProxy.resultAddressChanged($scope.$index, $scope.ed, viewport);
    }
  };
}

function ClipperEntityPhotoCtrl($scope, $window) {
  if (_.isEmpty($scope.ed['photo_urls'])) {
    $scope.ed['photo_urls'] = [];
  }
  var urls = $scope.ed['photo_urls'];
  var selectedImgIndex = urls.length ? 0 : null;

  $($window).on('message', function(event) {
    $scope.$apply(function() {
      if (event.originalEvent.data['message'] == 'tc-image-dropped') {
        var imgUrl = event.originalEvent.data['data']['tc-drag-image-url'];
        if (imgUrl) {
          urls.push(imgUrl);
          selectedImgIndex = urls.length - 1;
        } else {
          alert("Sorry, we couldn't recognize that image!");
        }
      }
    });
  });

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
}

window['initClipper'] = function(allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues)
    .value('$tripPlanState', new TripPlanState(_.isEmpty(allTripPlans) ? null : allTripPlans[0]))
    .value('$clipperStateModel', new ClipperStateModel());

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('ClipperRootCtrl', ClipperRootCtrl)
    .controller('ClipperPanelCtrl', ClipperPanelCtrl)
    .controller('TripPlanPanelCtrl', TripPlanPanelCtrl)
    .controller('ClipperTripPlanEntityCtrl', ClipperTripPlanEntityCtrl)
    .controller('ClipperOmniboxCtrl', ClipperOmniboxCtrl)
    .controller('ClipperResultEntityCtrl', ClipperResultEntityCtrl)
    .controller('ClipperEntityPhotoCtrl', ClipperEntityPhotoCtrl)
    .service('$mapProxy', MapProxy)
    .directive('tcStartNewTripInput', tcStartNewTripInput)
    .directive('tcEntityListing', tcEntityListing)
    .directive('tcSearchResultIcon', tcSearchResultIcon);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
