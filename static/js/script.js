function EntityModel(entityData) {
  this.data = entityData;
  this.marker = makeMarker(entityData);
  this.infowindow = makeInfowindow(entityData);
}

function makeMarker(entity) {
  var latlng = new google.maps.LatLng(entity['latlng']['lat'], entity['latlng']['lng']);
  var entityName = entity['name'];
  var markerData = {
    position: latlng,
    map: null,
    title: entityName
    //icon: '/static/img/' + entity['icon_url']
  };
  if (entity['address_precision'] == 'Imprecise') {
    markerData.icon = '/static/img/circle_marker.png'
  }
  return new google.maps.Marker(markerData);
}

function makeInfowindow(entity) {
  var infowindowContent = '<b>' + entity['name'] + '</b>';
  return new google.maps.InfoWindow({content: infowindowContent});
}


function EntityTypeCtrl($scope, $map, $mapBounds) {
  var me = this;
  this.entityModels = [];
  $scope.show = true;

  $.each($scope.entities, function(i, entity) {
    me.entityModels.push(new EntityModel(entity));
  });
  $.each(this.entityModels, function(i, entityModel) {
    var marker = entityModel.marker;
    marker.setMap($map);
    $mapBounds.extend(marker.getPosition())
    google.maps.event.addListener(marker, 'click', function() {
      entityModel.infowindow.open($map, marker);
    });
  });
  // TODO: Move this after all have initialized.
  $map.fitBounds($mapBounds);

  $scope.toggleSection = function() {
    $scope.show = !$scope.show;
    $.each(me.entityModels, function(i, entityModel) {
      entityModel.marker.setMap($scope.show ? $map : null);
    });
  };

  $scope.openInfowindow = function(entityName) {
    $.each(me.entityModels, function(i, entityModel) {
      if (entityModel.data['name'] == entityName) {
        entityModel.infowindow.open($map, entityModel.marker);
      } else {
        entityModel.infowindow.close();
      }
    });
  };
}


function createMap() {
  var mapOptions = {
    center: new google.maps.LatLng(-25.363882,131.044922),
    zoom: 8
  };
  return new google.maps.Map($('#map')[0], mapOptions);
}

window['initApp'] = function() {
  angular.module('mapModule', [])
    .value('$map', createMap())
    .value('$mapBounds', new google.maps.LatLngBounds());
  angular.module('appModule', ['mapModule']);
  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
