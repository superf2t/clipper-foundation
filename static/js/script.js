function hostnameFromUrl(url) {
  return $('<a>').attr('href', url)[0].hostname;
}

function EntityModel(entityData) {
  this.data = entityData;
  this.marker = makeMarker(entityData);
  this.infowindow = null;
  this.currentImgUrl = entityData['photo_urls'] && entityData['photo_urls'][0];
  this.currentImgUrlIndex = 0;

  this.hasDescription = function() {
    return this.data['description'] && this.data['description'].length;
  };

  this.advanceImg = function() {
    this.currentImgUrlIndex = (this.currentImgUrlIndex + 1) % this.data['photo_urls'].length;
    this.currentImgUrl = this.data['photo_urls'][this.currentImgUrlIndex];
  };

  this.makeInfowindow = function() {
    if (this.infowindow) {
      this.infowindow.close();
    }
    var infowindowContent = '<b>' + entityData['name'] + '</b>';
    this.infowindow = new google.maps.InfoWindow({content: infowindowContent});
    return this.infowindow;
  };

  this.clearMarker = function() {
    this.marker.setMap(null);
    this.marker = null;
    if (this.infowindow) {
      this.infowindow.close();
      this.infowindow = null;
    }
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


function TripPlanModel(tripPlanData) {
  this.data = tripPlanData;

  this.hasClippedPages = function() {
    return this.data['clipped_pages'] && this.data['clipped_pages'].length;
  };

  this.ENTITY_TYPES_IN_ORDER = ['Hotel', 'Restaurant', 'Attraction'];

  this.entitiesForType = function(entityType) {
    var entities = [];
    $.each(this.data['entities'], function(i, entity) {
      if (entity['entity_type'] == entityType) {
        entities.push(entity);
      }
    });
    return entities;
  };

  // An approximate check of equality that only checks certain fields.
  this.fastEquals = function(otherModel) {
    if (this.data['name'] != otherModel.data['name']) {
      return false;
    }
    var currentSourceUrls = $.map(this.data['entities'], function(entity) {
      return entity['source_url'];
    });
    var newSourceUrls = $.map(otherModel.data['entities'], function(entity) {
      return entity['source_url'];
    });
    if (currentSourceUrls.length != newSourceUrls.length) {
      return false;
    }
    currentSourceUrls.sort();
    newSourceUrls.sort();
    return angular.equals(currentSourceUrls, newSourceUrls);
  };
}

function EntityTypeCtrl($scope, $map, $mapBounds) {
  var me = this;
  $scope.entityModels = [];
  $scope.show = true;

  $scope.$on('closeallinfowindows', function() {
    $.each($scope.entityModels, function(i, entityModel) {
      if (entityModel.infowindow) {
        entityModel.infowindow.close();
      }
    });
  });

  $scope.$on('clearallmarkers', function() {
    $.each($scope.entityModels, function(i, entityModel) {
      entityModel.clearMarker();
    });
  });

  $.each($scope.planModel.entitiesForType($scope.entityType), function(i, entity) {
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

  $scope.hasEntities = function() {
    return $scope.entityModels && $scope.entityModels.length;
  };

  $scope.openInfowindow = function(entityName) {
    $scope.$emit('asktocloseallinfowindows');
    $.each($scope.entityModels, function(i, entityModel) {
      if (entityModel.data['name'] == entityName) {
        entityModel.makeInfowindow().open($map, entityModel.marker);
      }
    });
  };
}

function EntityCtrl($scope, $http) {
  $scope.editing = false;

  $scope.openEditEntity = function() {
    $scope.editing = true;
  }

  $scope.cancelEditing = function() {
    $scope.editing = false;
  };

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

function RootCtrl($scope, $http, $timeout, $tripPlan, $tripPlanSettings) {
  $scope.planModel = new TripPlanModel($tripPlan);
  $scope.accountDropdownOpen = false;
  $scope.editingTripPlanSettings = false;
  $scope.editableTripPlanSettings = $tripPlanSettings;

  $scope.openAccountDropdown = function() {
    $scope.accountDropdownOpen = true;
  }

  $scope.loadTripPlan = function(tripPlanIdStr) {
    location.href = '/trip_plan/' + tripPlanIdStr;
  }

  $scope.editTripPlanSettings = function() {
    $scope.editingTripPlanSettings = true;
  };

  $scope.saveTripPlanSettings = function() {
    $http.post('/edittripplan', $scope.editableTripPlanSettings)
      .success(function(response) {
        if (response['status'] != 'Success') {
          alert(response['status']);
        } else {
          document.title = $scope.editableTripPlanSettings['name'];
        }
      })
      .error(function() {
        alert('Failed to save edits');
      });
    $scope.editingTripPlanSettings = false;
  };

  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  this.refresh = function() {
    // TODO: Don't refresh if the user is currently editing.
    $http.get('/trip_plan_ajax/' + $tripPlanSettings['trip_plan_id_str'])
      .success(function(response) {
        var newModel = new TripPlanModel(response['trip_plan']);
        if (!$scope.planModel || !$scope.planModel.fastEquals(newModel)) {
          $scope.$broadcast('clearallmarkers');
          // Angular's dirty-checking does not seem to pick up that the
          // model has changed if we just assign to the new model...
          $scope.planModel = null;
          $timeout(function() {
            $scope.planModel = newModel;
          });
        }
      });
  };

  var me = this;
  var refreshInterval = 5000;
  function refreshPoll() {
    me.refresh();
    $timeout(refreshPoll, refreshInterval);
  }
  $timeout(refreshPoll, refreshInterval);
}


function ClippedPagesCtrl($scope) {
  $scope.clippingActive = false;

  $scope.openPageForClipping = function(url) {
    $scope.clippingPageUrl = url;
    $scope.clippingActive = true;
  };
}


function NavigationCtrl($scope, $location, $anchorScroll) {
  $scope.navigate = function(entityType) {
    $location.hash(entityType)
    $anchorScroll();
  };
}


function createMap() {
  var mapOptions = {
    center: new google.maps.LatLng(-25.363882,131.044922),
    zoom: 8
  };
  return new google.maps.Map($('#map')[0], mapOptions);
}

window['initApp'] = function(tripPlan, tripPlanSettings) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanSettings', tripPlanSettings);
  angular.module('mapModule', [])
    .value('$map', createMap())
    .value('$mapBounds', new google.maps.LatLngBounds());
  angular.module('appModule', ['mapModule', 'initialDataModule'], function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');
  })
    .controller('RootCtrl', ['$scope', '$http', '$timeout', '$tripPlan', '$tripPlanSettings', RootCtrl])
    .controller('EntityTypeCtrl', ['$scope', '$map', '$mapBounds', EntityTypeCtrl])
    .controller('EntityCtrl', ['$scope', '$http', EntityCtrl])
    .controller('ClippedPagesCtrl', ['$scope', ClippedPagesCtrl])
    .controller('NavigationCtrl', ['$scope', '$location', '$anchorScroll', NavigationCtrl])
    .filter('hostname', function() {
      return function(input) {
        return hostnameFromUrl(input);
      }
    });
  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
