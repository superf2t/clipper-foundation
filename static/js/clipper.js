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
    $scope.entities = entities;
    if (entities.length == 1) {
      $scope.entities[0].selected = true;
    }
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
    $scope.entities.push(entityData);
    $scope.clipperState.status = ClipperState.SUMMARY;
    $scope.displayState.dirtyCounter++;
  };

  $scope.startManualEntry = function() {
    var entityData = {
      'icon_url': DEFAULT_ICON_URL,
      'source_url': getParameterByName('url')
    };
    $scope.addEntity(entityData);
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
    return $scope.entities.length == $scope.selectedEntities().length;
  };

  $scope.selectAll = function() {
    $.each($scope.entities, function(i, entity) {
      entity.selected = true;
    });
  };

  $scope.deselectAll = function() {
    $.each($scope.entities, function(i, entity) {
      entity.selected = false;
    });
  };

  $scope.closeAllEditors = function() {
    $scope.$broadcast('closealleditors');
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

function ClipperEntityCtrl($scope, $window) {
  var me = this;
  $scope.ed = $scope.entity;
  $scope.em = new EntityModel($scope.ed);
  $scope.im = new ItemModel($scope.ed);

  $scope.editNotesState = {active: false};
  $scope.editPhotosState = {active: false};
  $scope.editLocationState = {active: !$scope.ed['name']};
  var editorStates = [$scope.editNotesState, $scope.editPhotosState, $scope.editLocationState];

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
  };

  $scope.closeEditor = function() {
    $scope.stopEditingPhotos();
    _.each(editorStates, function(state) {state.active = false});
  };

  $scope.$on('closealleditors', function() {
    $scope.closeEditor();
  });

  this.createMarker = function(latlng, opt_map) {
    var marker = new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/map-icons/' + $scope.ed['icon_url'],
      map: opt_map
    });
    google.maps.event.addListener(marker, 'dragend', function() {
      var entityData = $scope.ed;
      if (_.isEmpty(entityData['latlng'])) {
        entityData['latlng'] = {};
      }
      entityData['latlng']['lat'] = marker.getPosition().lat();
      entityData['latlng']['lng'] = marker.getPosition().lng();
      entityData['address_precision'] = 'Precise';
      me.updateMarkerIcon();
    });
    return marker;
  };

  $scope.map = null;
  var center = $scope.em.hasLocation()
    ? $scope.em.gmapsLatLng()
    : new google.maps.LatLng(0, 0);
  var marker = this.createMarker(center);
  $scope.mapOptions = {
    center: center,
    zoom: $scope.em.hasLocation() ? 15 : 2,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };

  $scope.setupMap = function($map) {
    $scope.map = $map;
    marker.setMap($map);
  };

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
      $scope.map.setCenter(location);
      marker.setPosition(location);
      me.updateMarkerIcon();
      if (place['geometry']['viewport']) {
        $scope.map.fitBounds(place['geometry']['viewport']);
      }
    }
  };

  this.updateMarkerIcon = function() {
    var data =  $scope.ed;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    data['icon_url'] = iconUrl;
    marker.setIcon('/static/img/map-icons/' + iconUrl)
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

window['initClipper'] = function(entities, needsPageSource,
    allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$entities', entities)
    .value('$needsPageSource', needsPageSource)
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues);

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('ClipperRootCtrl', ['$scope', '$window', '$http', '$timeout', '$entityService',
      '$needsPageSource', '$entities', '$allTripPlans', '$datatypeValues', ClipperRootCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .controller('ClipperEntityCtrl', ClipperEntityCtrl)
    .controller('ClipperEntityPhotoCtrl', ClipperEntityPhotoCtrl)
    .directive('tcStartNewTripInput', tcStartNewTripInput);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
