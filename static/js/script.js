function hostnameFromUrl(url) {
  return $('<a>').attr('href', url)[0].hostname;
}

function EntityModel(entityData) {
  this.data = entityData;
  this.marker = makeMarker(entityData);
  this.infowindow = null;

  this.carouselInterval = -1;
  this.slides = $.map(entityData['photo_urls'], function(imageUrl) {
    return {
      image: imageUrl
    };
  });

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
      entityModel.makeInfowindow().open($map, marker);
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

function EntityCtrl($scope, $http, $tripPlanSettings) {
  $scope.editing = false;

  $scope.openEditEntity = function() {
    $scope.editing = true;
  }

  $scope.cancelEditing = function() {
    $scope.editing = false;
  };

  $scope.saveEntityEdit = function() {
    var editRequest = {
      'trip_plan_id_str': $tripPlanSettings['trip_plan_id_str'],
      'entity': $scope.entityModel.data
    }
    $http.post('/editentity', editRequest).success(function(response) {
      if (response['status'] != 'Success') {
        alert('Failed to save edits');
      }
    }).error(function() {
      alert('Failed to save edits');
    });
    $scope.editing = false;
  };

  $scope.deleteEntity = function() {
    var deleteRequest = {
      'trip_plan_id_str': $tripPlanSettings['trip_plan_id_str'],
      'source_url': $scope.entityModel.data['source_url']
    };
    $http.post('/deleteentity', deleteRequest)
      .success(function(response) {
        if (response['status'] == 'Success') {
          $scope.refresh();
        } else {
          alert('Failed to delete entity');
        }
      })
      .error(function() {
        alert('Failed to delete entity')
      });
  };
}

function RootCtrl($scope, $http, $timeout, $modal, $tripPlan, $tripPlanSettings) {
  var me = this;
  $scope.planModel = new TripPlanModel($tripPlan);
  $scope.accountDropdownOpen = false;
  $scope.editingTripPlanSettings = false;
  $scope.editableTripPlanSettings = {
    name: $tripPlanSettings['name']
  };
  $scope.refreshState = {
    paused: false
  };
  $scope.clipState = {
    url: null,
    clipping: false,
    statusCode: null
  };

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
    var editRequest = {
      'trip_plan_id_str': $tripPlanSettings['trip_plan_id_str'],
      'name': $scope.editableTripPlanSettings.name
    };
    $http.post('/edittripplan', editRequest)
      .success(function(response) {
        if (response['status'] != 'Success') {
          alert(response['status']);
        } else {
          var newName = $scope.editableTripPlanSettings.name;
          document.title = newName;
          $scope.planModel.data['name'] = newName;
          $tripPlanSettings['name'] = newName;
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

  $scope.clipUrlChanged = function() {
    // Ugly hack to wrap this in a timeout; without it, the paste
    // event fires before the input has been populated with the pasted
    // data, so both [text input].val() and $scope.clipState.url
    // are empty.
    $timeout(function() {
      if (!$scope.clipState.url) {
        return;
      }
      $scope.clipState.clipping = true;
      var modal = $modal.open({
        templateUrl: 'clipping-modal-template',
        scope: $scope
      });
      me.clip($scope.clipState.url, function(response) {
        $scope.clipState.url = '';
        $scope.clipState.clipping = false;
        $scope.clipState.statusCode = response['clip_status'];
        $scope.clipState.entity = response['entity'];
        $timeout(function() {
          modal.close();
        }, 3000);
      }, function() {
        $scope.clipState.url = '';
        $scope.clipState.clipping = false;
        $scope.clipState.statusCode = 0; // Error code
        $timeout(function() {
          modal.close();
        }, 3000);
      });
    });
  };

  this.clip = function(url, opt_successCallback, opt_errorCallback) {
    $scope.refreshState.paused = true;
    var postUrl = '/clip_ajax/' + $tripPlanSettings['trip_plan_id_str'];
    $http.post(postUrl, {url: url})
      .success(function(response) {
        $scope.refreshState.paused = false;
        me.refresh()
        if (opt_successCallback) {
          opt_successCallback(response);
        }
      })
      .error(opt_errorCallback);
  };

  this.refresh = $scope.refresh = function() {
    if ($scope.refreshState.paused) {
      return;
    }
    // TODO: Don't refresh if the user is currently editing.
    $http.get('/trip_plan_ajax/' + $tripPlanSettings['trip_plan_id_str'])
      .success(function(response) {
        if ($scope.refreshState.paused) {
          return;
        }
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

function ngScrollToOnClick($parse) {
  return {
      restrict: 'AEC',
      link: function(scope, elem, attrs) {
        var getScrollToIdFn = $parse(attrs.ngScrollToOnClick);
        if (getScrollToIdFn) {
          elem.on('click', function() {
            var scrollToId = getScrollToIdFn();
            $('html, body').animate({
              scrollTop: ($("#" + scrollToId).offset().top - 73)
            }, 500);
          });
        }
      }
  };
}

window['initApp'] = function(tripPlan, tripPlanSettings) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanSettings', tripPlanSettings);
  angular.module('mapModule', [])
    .value('$map', createMap())
    .value('$mapBounds', new google.maps.LatLngBounds());
  angular.module('appModule', ['mapModule', 'initialDataModule', 'ui.bootstrap'], function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');
  })
    .directive('ngScrollToOnClick', ngScrollToOnClick)
    .controller('RootCtrl', ['$scope', '$http', '$timeout', '$modal', '$tripPlan', '$tripPlanSettings', RootCtrl])
    .controller('EntityTypeCtrl', ['$scope', '$map', '$mapBounds', EntityTypeCtrl])
    .controller('EntityCtrl', ['$scope', '$http', '$tripPlanSettings', EntityCtrl])
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
