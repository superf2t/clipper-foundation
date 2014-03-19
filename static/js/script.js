function hostnameFromUrl(url) {
  return $('<a>').attr('href', url)[0].hostname;
}

function EntityModel(entityData) {
  this.data = entityData;
  this.marker = makeMarker(entityData);
  this.infowindow = makeInfowindow(entityData);

  this.hasDescription = function() {
    return this.data['description'] && this.data['description'].length;
  };
}

function makeMarker(entity) {
  var latlng = new google.maps.LatLng(entity['latlng']['lat'], entity['latlng']['lng']);
  var entityName = entity['name'];
  var markerData = {
    position: latlng,
    map: null,
    title: entityName,
    icon: '/static/img/' + entity['icon_url']
  };
  return new google.maps.Marker(markerData);
}

function makeInfowindow(entity) {
  var infowindowContent = '<b>' + entity['name'] + '</b>';
  return new google.maps.InfoWindow({content: infowindowContent});
}


function EntityTypeCtrl($scope, $map, $mapBounds) {
  var me = this;
  $scope.entityModels = [];
  $scope.show = true;

  $scope.$on('closeallinfowindows', function() {
    $.each($scope.entityModels, function(i, entityModel) {
      entityModel.infowindow.close();
    });
  });

  $.each($scope.entities, function(i, entity) {
    $scope.entityModels.push(new EntityModel(entity));
  });
  $.each($scope.entityModels, function(i, entityModel) {
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
    $.each($scope.entityModels, function(i, entityModel) {
      entityModel.marker.setMap($scope.show ? $map : null);
    });
  };

  $scope.openInfowindow = function(entityName) {
    $scope.$emit('asktocloseallinfowindows');
    $.each($scope.entityModels, function(i, entityModel) {
      if (entityModel.data['name'] == entityName) {
        entityModel.infowindow.open($map, entityModel.marker);
      }
    });
  };
}

function EntityCtrl($scope, $http) {
  $scope.editing = false;

  $scope.openEditEntity = function() {
    $scope.editing = true;
  }

  $scope.saveEntityEdit = function() {
    $http.post('/editentity', $scope.entityModel.data).success(function(response) {
      if (response['status'] != 'Success') {
        alert('Failed to save edits');
      }
    }).error(function() {
      alert('Failed to save edits');
    });
    $scope.editing = false;
  }
}

function RootCtrl($scope) {
  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });
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
  angular.module('appModule', ['mapModule'], function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');
  })
    .controller('RootCtrl', ['$scope', RootCtrl])
    .controller('EntityTypeCtrl', ['$scope', '$map', '$mapBounds', EntityTypeCtrl])
    .controller('EntityCtrl', ['$scope', '$http', EntityCtrl])
    .filter('hostname', function() {
      return function(input) {
        return hostnameFromUrl(input);
      }
    });
  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
