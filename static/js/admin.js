function AdminEditorCtrl($scope, $tripPlan, $entities) {
  $scope.tripPlan = $tripPlan;
  $scope.entities = $entities;

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
      me.updateMarkerIcon();
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
    marker.setMap(map);
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

window['initAdminEditor'] = function(tripPlan, entities) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$entities', entities);

  angular.module('adminEditorModule', ['initialDataModule', 'servicesModule',
      'directivesModule', 'filtersModule', 'ui.bootstrap', ],
      interpolator)
    .controller('AdminEditorCtrl', ['$scope', '$tripPlan', '$entities', AdminEditorCtrl])
    .controller('AdminEntityCtrl', ['$scope', AdminEntityCtrl]);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['adminEditorModule']);
  });
};
