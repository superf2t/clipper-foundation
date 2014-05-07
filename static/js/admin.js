function AdminEditorCtrl($scope, $tripPlan, $entities,
    $datatypeValues, $tripPlanService, $entityService, $modal) {
  $scope.tripPlan = $tripPlan;
  $scope.entities = $entities;

  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];

  $scope.lookupLocationsOnSave = false;

  this.createMapOptions = function(tripPlan) {
    var center = new google.maps.LatLng(0, 0);
    if (tripPlan['location_latlng']) {
      center = gmapsLatLngFromJson($tripPlan['location_latlng']);
    }
    return {
      center: center,
      zoom: 2,
      panControl: false,
      scaleControl: true,
      scrollwheel: false,
      streetViewControl: false,
      mapTypeControlOptions: {
        mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP
      }
    };
  };

  $scope.locationMap = null;
  $scope.centerMarker = null;
  $scope.tripPlanLocationMapOptions = this.createMapOptions($tripPlan);

  $scope.setupMap = function(map) {
    // TODO: This should not be necessary, figure out why the map= model
    // expression on tc-google map is not assigning properly.
    $scope.locationMap = map;
    if ($tripPlan['location_bounds']) {
      map.fitBounds(gmapsBoundsFromJson($tripPlan['location_bounds']));
    }
    var centerMarker = $scope.centerMarker = new google.maps.Marker({
      draggable: true,
      position: map.getCenter(),
      map: map
    });
    google.maps.event.addListener(centerMarker, 'dragend', function() {
      if (!$tripPlan['location_latlng']) {
        $tripPlan['location_latlng'] = {};
      }
      $tripPlan['location_latlng']['lat'] = centerMarker.getPosition().lat();
      $tripPlan['location_latlng']['lng'] = centerMarker.getPosition().lng();
    });
  };

  $scope.locationChanged = function(place) {
    if (!place['reference']) {
      return;
    }
    var geometry = place['geometry'];
    var location = geometry && geometry['location'];
    var viewport = geometry && geometry['viewport'];
    $tripPlan['location_name'] = place['formatted_address'];
    $tripPlan['location_latlng'] = latlngFromGmaps(location);
    $tripPlan['location_bounds'] = boundsJsonFromGmapsBounds(viewport);
    if (location) {
      $scope.locationMap.setCenter(location);
      $scope.centerMarker.setPosition(location);
    }
    if (viewport) {
      $scope.locationMap.fitBounds(viewport);
    }
  };

  $scope.saveEverything = function() {
    $modal.open({
      templateUrl: 'saving-modal-template',
      scope: $scope
    });
    $scope.saveTripPlanSettings()
      .success(function(response) {
        $scope.saveEntities()
          .success(function(response) {
            if ($scope.lookupLocationsOnSave) {
              $adminCtrl.augmententities($tripPlan['trip_plan_id']);
            } else {
              $scope.saved = true;              
            }
        });
      });
  };

  $scope.saveTripPlanSettings = function() {
    return $tripPlanService.editTripPlan($tripPlan);
  };

  $scope.saveEntities = function() {
    var operations = _.map($entities, function(entity) {
      return $entityService.operationFromEntity(entity,
        $tripPlan['trip_plan_id'],
        entity._deleted ? Operator.DELETE : Operator.EDIT);
    });
    return $entityService.mutate({'operations': operations});
  };
}

function AdminEntityCtrl($scope) {
  this.createMarker = function(latlng, opt_map) {
    var marker = new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/' + $scope.entity['icon_url'],
      map: opt_map
    });
    google.maps.event.addListener(marker, 'dragend', function() {
      var entityData = $scope.entity;
      if (_.isEmpty(entityData['latlng'])) {
        entityData['latlng'] = {};
      }
      entityData['latlng']['lat'] = marker.getPosition().lat();
      entityData['latlng']['lng'] = marker.getPosition().lng();
      entityData['address_precision'] = 'Precise';
      $scope.updateMarkerIcon();
    });
    return marker;
  };

  $scope.entityMap = null;
  var center = !_.isEmpty($scope.entity['latlng'])
    ? gmapsLatLngFromJson($scope.entity['latlng'])
    : new google.maps.LatLng(0, 0);
  var marker = this.createMarker(center);
  $scope.entityMapOptions = {
    center: center,
    zoom: !_.isEmpty($scope.entity['latlng']) ? 15 : 2,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };

  $scope.setupEntityMap = function(map) {
    $scope.entityMap = map;
    marker.setMap(map);
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entity;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    data['icon_url'] = iconUrl;
    marker.setIcon('/static/img/' + iconUrl)
  };

  $scope.addressChanged = function(place) {
    if (!place['reference']) {
      return;
    }
    var geometry = place['geometry'];
    var location = geometry && geometry['location'];
    $scope.entity['latlng'] = latlngFromGmaps(location);
    marker.setPosition(location);
    $scope.entityMap.setCenter(location);
    $scope.entity['address'] = place['formatted_address'];
  };

  $scope.markAsDeleted = function() {
    $scope.entity._deleted = true;
  };

  $scope.unmarkAsDeleted = function() {
    $scope.entity._deleted = false;
  };
}

function AdminEntityPhotoCtrl($scope) {
  if (_.isEmpty($scope.entity['photo_urls'])) {
    $scope.entity['photo_urls'] = [];
  }
  var urls = $scope.entity['photo_urls'];
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
}

window['initAdminEditor'] = function(tripPlan, entities, datatypeValues) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$entities', entities)
    .value('$datatypeValues', datatypeValues);

  angular.module('adminEditorModule', ['initialDataModule', 'servicesModule',
      'directivesModule', 'filtersModule', 'ui.bootstrap', ],
      interpolator)
    .controller('AdminEditorCtrl', ['$scope', '$tripPlan',
      '$entities', '$datatypeValues', '$tripPlanService', '$entityService',
      '$modal', AdminEditorCtrl])
    .controller('AdminEntityCtrl', ['$scope', AdminEntityCtrl])
    .controller('AdminEntityPhotoCtrl', ['$scope', AdminEntityPhotoCtrl]);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['adminEditorModule']);
  });
};
