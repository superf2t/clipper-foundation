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

function ClipperRootCtrl($scope, $window, $http, $timeout, $entityService,
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
  };

  $scope.startManualEntry = function() {
    var entityData = {
      'icon_url': 'sight-2.png',
      'source_url': getParameterByName('url')
    };
    $scope.addEntity(entityData);
  };

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

  $scope.saveButtonEnabled = function() {
    var selectedEntities = me.selectedEntities();
    if (!selectedEntities.length) {
      return false;
    }
    var entitiesWithNames = _.filter(selectedEntities, function(entity) {
      return !!entity['name'];
    });
    return entitiesWithNames.length > 0 && selectedEntities.length == entitiesWithNames.length;
  };

  $scope.saveEntities = function() {
    var entitiesToSave = me.selectedEntities();
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
    return $scope.entityModels.length == me.selectedEntityModels().length;
  };

  $scope.toggleSelectAll = function() {
    var newSelectedState = !$scope.allEntitiesSelected()
    $.each($scope.entityModels, function(i, entityModel) {
      entityModel.selected = newSelectedState;
    });
  };

  $scope.dismissClipper = function() {
    $window.parent.postMessage('tc-close-clipper', '*');
  };
}

var ClipperEntityState = {
  NOT_EDITING: 1,
  EDITING_NOTE: 2,
  EDITING_PHOTOS: 3,
  EDITING_LOCATION: 4
};

function ClipperEntityCtrl($scope, $window) {
  var me = this;
  $scope.ed = $scope.entityModel.data;
  $scope.state = $scope.ed['name'] ? ClipperEntityState.NOT_EDITING
    : ClipperEntityState.EDITING_LOCATION;
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
      entityData['address_precision'] = 'Precise';
      me.updateMarkerIcon();
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
    $window.parent.postMessage('tc-photo-editing-inactive', '*'); 
  };

  $scope.openEditNote = function() {
    $scope.state = ClipperEntityState.EDITING_NOTE;
  };

  $scope.openEditLocation = function() {
    $scope.state = ClipperEntityState.EDITING_LOCATION;
  };

  $scope.openEditPhotos = function() {
    $scope.state = ClipperEntityState.EDITING_PHOTOS;
    $window.parent.postMessage('tc-photo-editing-active', '*'); 
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
    marker.setIcon('/static/img/' + iconUrl)
  };
}

function ClipperPhotoCtrl($scope, $window) {
  if (_.isEmpty($scope.ed['photo_urls'])) {
    $scope.ed['photo_urls'] = [];
  }
  var urls = $scope.ed['photo_urls'];
  var selectedImgIndex = urls.length ? 0 : null;

  $($window).on('message', function(event) {
    $scope.$apply(function() {
      if ($scope.state != ClipperEntityState.EDITING_PHOTOS) {
        return;
      }
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
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule', 'ui.bootstrap'],
      interpolator)
    .controller('ClipperRootCtrl', ['$scope', '$window', '$http', '$timeout', '$entityService',
      '$needsPageSource', '$entities', '$allTripPlans', '$datatypeValues', ClipperRootCtrl])
    .controller('ClipperEntityCtrl', ['$scope', '$window', ClipperEntityCtrl])
    .controller('ClipperPhotoCtrl', ['$scope', '$window', ClipperPhotoCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .directive('tcStartNewTripInput', tcStartNewTripInput);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
