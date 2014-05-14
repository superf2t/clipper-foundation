function AdminEditorCtrl($scope, $modal, $tripPlan, $entities,
    $taxonomy, $tripPlanService, $entityService, $adminService) {
  $scope.tripPlan = $tripPlan;
  $scope.entities = $entities;

  $scope.categories = $taxonomy.allCategories();
  $scope.getSubCategories = function(categoryId) {
    return $taxonomy.getSubCategoriesForCategory(categoryId);
  };

  $scope.saveSettings = {
    lookupLocationsOnSave: false
  };

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

  $scope.coverImgDropped = function($dataTransfer) {
    var imgUrl = $dataTransfer.getData('text/uri-list');
    if (!imgUrl) {
      return;
    }
    $tripPlan['cover_image_url'] = imgUrl;
  };

  $scope.saveEverything = function() {
    $scope.saving = true;
    $modal.open({
      templateUrl: 'saving-modal-template',
      scope: $scope,
      backdrop: 'static',
      keyboard: false
    });
    $scope.saveTripPlanSettings()
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.saveEntities()
            .success(function(response) {
              if ($scope.saveSettings.lookupLocationsOnSave) {
                $adminService.augmententities($tripPlan['trip_plan_id'])
                  .success(function(response) {
                    if (response['response_code'] == ResponseCode.SUCCESS) {
                      $scope.saved = true; 
                      $scope.saving = false;
                    } else if (extractError(response, CommonError.NOT_AUTHORIZED_FOR_OPERATION)) {
                      $scope.notAuthorized = true;
                      $scope.saving = false;
                    }
                  });
              } else {
                $scope.saved = true;     
                $scope.saving = false;         
              }
            });
        } else if (extractError(response, CommonError.NOT_AUTHORIZED_FOR_OPERATION)) {
          $scope.notAuthorized = true;
          $scope.saving = false;
        }
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

function AdminEntityCtrl($scope, $taxonomy) {
  this.createMarker = function(latlng, opt_map) {
    var marker = new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/map-icons/' + $scope.entity['icon_url'],
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

  $scope.categoryChanged = function() {
    $scope.entity['sub_category'] = $taxonomy.getSubCategoriesForCategory(
      $scope.entity['category']['category_id'])[0];
    $scope.updateMarkerIcon();
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entity;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    data['icon_url'] = iconUrl;
    marker.setIcon('/static/img/map-icons/' + iconUrl)
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

  $scope.imgDropped = function($dataTransfer) {
    var imgUrl = $dataTransfer.getData('text/uri-list');
    if (!imgUrl) {
      return;
    }
    $scope.$broadcast('photo-appended', imgUrl);
  };
}

function AdminEntityPhotoCtrl($scope) {
  if (_.isEmpty($scope.entity['photo_urls'])) {
    $scope.entity['photo_urls'] = [];
  }
  var urls = $scope.entity['photo_urls'];
  var selectedImgIndex = urls.length ? 0 : null;

  $scope.$on('photo-appended', function(event, imgUrl) {
    urls.push(imgUrl);
    selectedImgIndex = urls.length - 1;
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

function AdminService($http) {
  this.augmententities = function(tripPlanId) {
    return $http.post('/adminservice/augmententities', {'trip_plan_id': tripPlanId});
  };
}

function tcBasicDropTarget($document, $parse) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      if (attrs.dragstartClass) {
        $document.on('dragstart', function() {
          elem.addClass(attrs.dragstartClass);
        }).on('dragend', function() {
          elem.removeClass(attrs.dragstartClass);
        });
      }
      if (attrs.dragenterClass) {
        elem.on('dragenter', function() {
          elem.addClass(attrs.dragenterClass);
        }).on('dragleave', function() {
          elem.removeClass(attrs.dragenterClass);
        });
      }
      if (attrs.dragoverClass) {
        elem.on('dragover', function() {
          elem.addClass(attrs.dragoverClass);
        }).on('dragleave', function() {
          elem.removeClass(attrs.dragoverClass);
        });
      }
      if (attrs.tcOndrop) {
        var ondropFn = $parse(attrs.tcOndrop);
        elem.on('dragover', function(event) {
          event.preventDefault();
        });
        elem.on('drop', function(event) {
          try {
            scope.$apply(function() {
              ondropFn(scope, {
                $event: event,
                $dataTransfer: event.originalEvent.dataTransfer
              });
            });
          } catch (error) {
            console.log(error);
          }
          if (attrs.dragoverClass) {
            elem.removeClass(attrs.dragoverClass);          
          }
          event.preventDefault();
        });
      }
    }
  };
}

window['initAdminEditor'] = function(tripPlan, entities, datatypeValues) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$entities', entities)
    .value('$taxonomy', new TaxonomyTree(datatypeValues['categories'], datatypeValues['sub_categories']));

  angular.module('adminEditorModule', ['initialDataModule', 'servicesModule',
      'directivesModule', 'filtersModule', 'ui.bootstrap', ],
      interpolator)
    .controller('AdminEditorCtrl', ['$scope', '$modal', '$tripPlan', '$entities',
      '$taxonomy', '$tripPlanService', '$entityService', '$adminService',
      AdminEditorCtrl])
    .controller('AdminEntityCtrl', ['$scope', '$taxonomy', AdminEntityCtrl])
    .controller('AdminEntityPhotoCtrl', ['$scope', AdminEntityPhotoCtrl])
    .service('$adminService', ['$http', AdminService])
    .directive('tcBasicDropTarget', tcBasicDropTarget);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['adminEditorModule']);
  });
};
