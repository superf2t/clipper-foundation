function hostnameFromUrl(url) {
  var fullHost = $('<a>').attr('href', url)[0].hostname;
  if (fullHost.substring(0, 4) == 'www.') {
    return fullHost.substring(4);
  }
  return fullHost;
}

function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function looksLikeUrl(text) {
  if (!text) {
    return false;
  }
  return text.toLowerCase().substring(0, 4) == 'http';
}

function dictByAttr(objs, attrNameOrFn) {
  var dict = {};
  var isFn = _.isFunction(attrNameOrFn);
  $.each(objs, function(i, obj) {
    var attr = isFn ? attrNameOrFn(obj) : obj[attrNameOrFn];
    dict[attr] = obj;
  });
  return dict;
}

function EntityModel(entityData, editable) {
  this.data = entityData;

  this.hasDescription = function() {
    return this.data['description'] && this.data['description'].length;
  };

  this.makeInfowindow = function(infowindowContent) {
    if (this.infowindow) {
      this.infowindow.close();
    }
    this.infowindow = new google.maps.InfoWindow({content: infowindowContent});
    return this.infowindow;
  };

  this.clearMarker = function() {
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }
    if (this.infowindow) {
      this.infowindow.close();
      this.infowindow = null;
    }
  };

  this.makeMarker =  function() {
    var entity = this.data;
    if (!entity['latlng']) {
      return null;
    }
    var latlng = new google.maps.LatLng(entity['latlng']['lat'], entity['latlng']['lng']);
    var entityName = entity['name'];
    var markerData = {
      position: latlng,
      map: null,
      title: entityName,
      icon: '/static/img/' + entity['icon_url'],
      draggable: editable
    };
    return new google.maps.Marker(markerData);
  }

  this.isPreciseLocation = function() {
    return this.data['address_precision'] == 'Precise';
  };

  this.hasLocation = function() {
    return !!this.data['latlng'];
  };

  this.marker = this.makeMarker();
  this.infowindow = null;
}

function TripPlanModel(tripPlanData, entityDatas, notes) {
  var me = this;

  this.resetEntities = function(entities) {
    this.entitiesById = dictByAttr(entities, 'entity_id');
    this.entityDatas = entities;
  };

  this.tripPlanData = tripPlanData;
  this.resetEntities(entityDatas);
  this.notes = notes;

  this.entitiesForCategory = function(category) {
    var entities = [];
    $.each(this.entityDatas, function(i, entity) {
      if (entity['category'] && entity['category']['category_id'] == category['category_id']) {
        entities.push(entity);
      }
    });
    return entities;
  };

  this.isEmpty = function() {
    return this.entityDatas.length == 0;
  };

  this.tripPlanId = function() {
    return this.tripPlanData['trip_plan_id'];
  };

  this.updateEntities = function(entityDatas) {
    var newEntitiesById = dictByAttr(entityDatas, 'entity_id');
    $.each(this.entityDatas, function(i, entityData) {
      var updatedEntity = newEntitiesById[entityData['entity_id']];
      if (updatedEntity) {
        me.entityDatas[i] = updatedEntity;
        me.entitiesById[updatedEntity['entity_id']] = updatedEntity;
      }
    });
  };

  this.updateNotes = function(noteDatas) {
    var newNotesById = dictByAttr(noteDatas, 'note_id');
    $.each(this.notes, function(i, note) {
      var noteId = note['note_id'];
      var updatedNote = newNotesById[noteId];
      if (updatedNote) {
        me.notes[i] = updatedNote;
        delete newNotesById[noteId];
      };
    });
    // Any leftover values are new notes, so we should append them.
    this.notes.push.apply(this.notes, _.values(newNotesById));
  };

  this.updateLastModified = function(lastModified) {
    this.tripPlanData['last_modified'] = lastModified;
  };
}

function CategoryCtrl($scope, $map, $mapBounds, $entityService, $templateToStringRenderer, $tripPlan, $allowEditing) {
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

  $.each($scope.planModel.entitiesForCategory($scope.category), function(i, entity) {
    $scope.entityModels.push(new EntityModel(entity, $allowEditing));
  });
  $.each($scope.entityModels, function(i, entityModel) {
    var marker = entityModel.marker;
    if (!marker) {
      return;
    }
    marker.setMap($map);
    $mapBounds.extend(marker.getPosition())
    google.maps.event.addListener(marker, 'click', function() {
      me.createInfowindow(entityModel, marker, true);
    });
    google.maps.event.addListener(marker, 'dragend', function() {
      entityModel.data['latlng']['lat'] = marker.getPosition().lat();
      entityModel.data['latlng']['lng'] = marker.getPosition().lng();
      me.saveEntity(entityModel.data);
    });
  });
  // TODO: Move this after all have initialized.
  if (!$mapBounds.isEmpty()) {
    $map.fitBounds($mapBounds);
  }

  this.saveEntity = function(entityData) {
    $entityService.editEntity(entityData, $tripPlan['trip_plan_id'])
      .error(function() {
        alert('Failed to save new marker location');
      });
  };

  $scope.toggleSection = function() {
    $scope.show = !$scope.show;
    $.each($scope.entityModels, function(i, entityModel) {
      if (entityModel.marker) {
        entityModel.marker.setMap($scope.show ? $map : null);
      }
    });
  };

  $scope.hasEntities = function() {
    return $scope.entityModels && $scope.entityModels.length;
  };

  $scope.openInfowindow = function(entityName) {
    $scope.$emit('asktocloseallinfowindows');
    $.each($scope.entityModels, function(i, entityModel) {
      if (entityModel.data['name'] == entityName && entityModel.hasLocation()) {
        me.createInfowindow(entityModel, entityModel.marker);
      }
    });
  };

  this.createInfowindow = function(entityModel, marker, opt_nonAngularOrigin) {
    var infowindowContent = $templateToStringRenderer.render('infowindow-template', {
      entity: entityModel
    }, opt_nonAngularOrigin);
    entityModel.makeInfowindow(infowindowContent[0]).open($map, marker);
  };
}

function EntityCtrl($scope, $entityService, $modal, $dataRefreshManager, $tripPlan) {
  $scope.editing = false;

  $scope.openEditEntity = function() {
    $scope.editing = true;
  }

  $scope.cancelEditing = function() {
    $scope.editing = false;
  };

  $scope.openEditPlaceModal = function() {
    var scope = $scope.$new(true);
    scope.isEditOfExistingEntity = true;
    var entityData = angular.copy($scope.entityModel.data);
    scope.entityModel = new EntityModel(entityData);
    scope.ed = scope.entityModel.data;
    $modal.open({
      templateUrl: 'add-place-confirmation-template',
      scope: scope
    });    
  };

  $scope.saveEntityEdit = function() {
    $entityService.editEntity($scope.entityModel.data, $tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlan['last_modified'] = response['last_modified'];
        } else {
          alert('Failed to save edits');
        }
      }).error(function() {
        alert('Failed to save edits');
      });
    $scope.editing = false;
  };

  $scope.reclipEntity = function() {
    var scope = $scope.$new(true);
    scope.entityModel = new EntityModel(angular.copy($scope.entityModel.data));
    scope.ed = scope.entityModel.data;
    scope.ed['entity_id'] = null;
    $modal.open({
      templateUrl: 'reclip-confirmation-template',
      scope: scope
    });
  };

  $scope.deleteEntity = function() {
    $entityService.deleteEntity($scope.entityModel.data, $tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $dataRefreshManager.askToRefresh();
        } else {
          alert('Failed to delete entity');
        }
      }).error(function() {
        alert('Failed to delete entity')
      });
  };
}

function TripPlanSelectDropdownCtrl($scope, $tripPlanService, $allTripPlans) {
  $scope.tripPlanSelectOptions = $allTripPlans.slice(0);
  $scope.tripPlanSelectOptions.push({
    'name': 'Create a new trip',
    'trip_plan_id': 0,
    createNew: true
  });
  if (!$scope.selectedTripPlan) {
    $scope.selectedTripPlan = $scope.tripPlanSelectOptions[0];
  }
  $scope.newTripPlanName = ''
  $scope.showCreateTripPlanForm = false;
  $scope.$watch('selectedTripPlan', function(newValue) {
    if (newValue.createNew) {
      $scope.showCreateTripPlanForm = true;
    } else {
      $scope.showCreateTripPlanForm = false;
    }
  });

  $scope.saveNewTripPlan = function() {
    if (!$scope.newTripPlanName) {
      return;
    }
    var newTripPlan = {'name': $scope.newTripPlanName};
    $tripPlanService.saveNewTripPlan(newTripPlan)
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.showCreateTripPlanForm = false;
          $scope.newTripPlanName = '';
          var newTripPlan = response['trip_plans'][0];
          $scope.tripPlanSelectOptions.splice(0, 0, newTripPlan);
          $scope.selectedTripPlan = newTripPlan;
        }
      });
  };
}

function ReclipConfirmationCtrl($scope, $timeout, $entityService) {
  $scope.selectionState = {
    selectedTripPlan: null
  };

  $scope.reclipEntity = function() {
    var tripPlanId = $scope.selectionState.selectedTripPlan['trip_plan_id'];
    $entityService.saveNewEntity($scope.entityModel.data, tripPlanId)
      .success(function(response) {
        $scope.reclipSucceeded = true;
        $timeout($scope.$close, 3000);
      });
  };

  $scope.dismissReclipConfirmation = function() {
    $scope.$close();
  };

  $scope.showSaveButtons = function() {
    return !$scope.selectionState.selectedTripPlan
      || $scope.selectionState.selectedTripPlan['trip_plan_id'] > 0;
  };
}

function TemplateToStringRenderer($rootScope, $templateCache, $compile) {

  // nonAngularOrigin means that this template is being rendered in response
  // to an event that originated outside of Angular, for example a click
  // on a Google Maps marker which is handled by the Maps event system.
  // In this case, since we're using Angular templates, we must manually
  // $apply the scope of the template to complete rendering.  We cannot
  // do this in all cases though because if the event originated within
  // Angular than we are already in the midst of a $digest cycle.
  this.render = function(templateName, scopeVariables, nonAngularOrigin) {
    var template = $templateCache.get(templateName);
    if (!template) {
      throw 'No template with name ' + templateName;
    }
    var scope = $rootScope.$new(true);
    if (scopeVariables) {
      $.extend(scope, scopeVariables);
    }
    var node = $compile(template)(scope);
    if (nonAngularOrigin) {
      scope.$apply();
    }
    return node;
  };
}

function PageStateModel() {
  var GUIDE_VIEW = 1;
  var MAP_VIEW = 2;

  this.view = MAP_VIEW;

  this.inGuideView = function() {
    return this.view == GUIDE_VIEW;
  };

  this.inMapView = function() {
    return this.view == MAP_VIEW;
  };

  this.showGuideView = function() {
    this.view = GUIDE_VIEW;
  };

  this.showMapView = function() {
    this.view = MAP_VIEW;
  };
}

function RootCtrl($scope, $http, $timeout, $modal, $tripPlanService, $tripPlanModel, $tripPlan, 
    $entityService, $datatypeValues, $allowEditing) {
  var me = this;
  $scope.pageStateModel = new PageStateModel();
  $scope.planModel = $tripPlanModel;
  $scope.orderedCategories = $datatypeValues['categories'];
  $scope.allowEditing = $allowEditing;
  $scope.accountDropdownOpen = false;
  $scope.omniboxState = {visible: false};
  $scope.editingTripPlanSettings = false;
  $scope.editableTripPlanSettings = {
    name: $tripPlan['name']
  };
  $scope.refreshState = {
    paused: false
  };
  $scope.clipState = {
    url: null,
    clipping: false,
    statusCode: null
  };

  $scope.toggleOmnibox = function() {
    $scope.omniboxState.visible = !$scope.omniboxState.visible;
  };

  $scope.showGuideView = function() {
    if (!$scope.pageStateModel.inGuideView()) {
      $scope.pageStateModel.showGuideView();
      $scope.$broadcast('masonry.reload');
    }
  };

  $scope.showMapView = function() {
    if (!$scope.pageStateModel.inMapView()) {
      $scope.pageStateModel.showMapView();
    }
  };

  $scope.navAnchor = function(categoryName) {
    if ($scope.pageStateModel.inMapView()) {
      return 'mapview-' + categoryName;
    } else if ($scope.pageStateModel.inGuideView()) {
      return 'guideview-' + categoryName;
    } else {
      return '';
    }
  };

  $scope.toggleAccountDropdown = function() {
    $scope.accountDropdownOpen = !$scope.accountDropdownOpen;
  }

  $scope.editTripPlanSettings = function() {
    $scope.editingTripPlanSettings = true;
  };

  $scope.saveTripPlanSettings = function() {
    if ($scope.editableTripPlanSettings.name == $tripPlan['name']) {
      $scope.editingTripPlanSettings = false;
      return;
    }
    var editedTripPlan = {
      'trip_plan_id': $tripPlan['trip_plan_id'],
      'name': $scope.editableTripPlanSettings.name
    };
    $tripPlanService.editTripPlan(editedTripPlan)
      .success(function(response) {
        var newName = $scope.editableTripPlanSettings.name;
        document.title = newName;
        $scope.planModel.tripPlanData['name'] = newName;
        // TODO: This might be redundant now.
        $tripPlan['name'] = newName;
      })
      .error(function() {
        alert('Failed to save edits');
      });
    $scope.editingTripPlanSettings = false;
  };

  $scope.cloneCurrentTripPlan = function() {
    $tripPlanService.cloneTripPlan($tripPlan['trip_plan_id'])
      .success(function(response) {
        var newTripPlanId = response['trip_plan']['trip_plan_id'];
        location.href = '/trip_plan/' + newTripPlanId;
      });
  };

  $scope.deleteCurrentTripPlan = function() {
    var ok = confirm('Are you sure you want to delete this trip plan?');
    if (!ok) {
      return;
    }
    $tripPlanService.deleteTripPlanById($tripPlan['trip_plan_id'])
      .success(function(response) {
        location.href = '/trip_plan';
      });
  };

  $scope.openDayPlanner = function(windowClass) {
    $modal.open({
      templateUrl: 'day-planner-template',
      scope: $scope.$new(true),
      backdrop: 'static',
      windowClass: windowClass
    });
  };

  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  this.refresh = function() {
    if ($scope.refreshState.paused || !$allowEditing) {
      return;
    }
    $entityService.getByTripPlanId($tripPlan['trip_plan_id'], $tripPlan['last_modified'])
      .success(function(response) {
        if ($scope.refreshState.paused) {
          return;
        }
        var planModel = $scope.planModel;
        var newEntities = response['entities'];
        $tripPlan['last_modified'] = response['last_modified'];
        if (newEntities && newEntities.length) {
          $scope.$broadcast('clearallmarkers');
          // Angular's dirty-checking does not seem to pick up that the
          // model has changed if we just assign to the new model...
          // Similarly, since the main iteration in the template is done
          // over 'orderedCategories', we must reset that variable
          // after a refresh for Angular to detect that it should re-iterate
          // over that part of the DOM.
          $scope.planModel = null;
          $scope.orderedCategories = null;
          $timeout(function() {
            planModel.resetEntities(newEntities);
            $scope.planModel = planModel;
            $scope.orderedCategories = $datatypeValues['categories'];
          });
        }
      });
  };

  $scope.$on('refreshdata', this.refresh);

  var refreshInterval = 5000;
  function refreshPoll() {
    me.refresh();
    $timeout(refreshPoll, refreshInterval);
  }
  $timeout(refreshPoll, refreshInterval);
}

function NavigationCtrl($scope, $location, $anchorScroll) {
  $scope.navigate = function(categoryName) {
    $location.hash(categoryName)
    $anchorScroll();
  };
}

function createMap() {
  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 2,
    panControl: false,
    scaleControl: true,
    streetViewControl: false,
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    }
  };
  return new google.maps.Map($('#map')[0], mapOptions);
}

function AccountDropdownCtrl($scope, $http, $tripPlanService, $accountInfo, $tripPlan, $allTripPlans) {
  $scope.accountInfo = $accountInfo;
  $scope.accountInfo.loggedIn = !!$accountInfo['email'];
  $scope.showLoginForm = !$scope.accountInfo.loggedIn;
  $scope.currentTripPlan = $tripPlan;
  $scope.allTripPlans = $allTripPlans;

  $scope.doLogin = function() {
    if ($scope.accountInfo['email']) {
      var loginRequest = {email: $scope.accountInfo['email']};
      $http.post('/login_and_migrate_ajax', loginRequest)
        .success(function(response) {
          if (response['status'] == 'Success') {
            location.href = location.href;
          } else if (response['status'] == 'Invalid email') {
            alert('Please enter a valid email address');
          } else {
            alert('Login failed')
          }
        })
        .error(function() {
          alert('Login failed');
        });
    }
  };

  $scope.loadTripPlan = function(tripPlanId) {
    location.href = '/trip_plan/' + tripPlanId;
  };

  $scope.createNewTripPlan = function() {
    if (!$scope.accountInfo.loggedIn) {
      alert('Please log in before creating additional trip plans');
      return;
    }
    $tripPlanService.saveNewTripPlan({'name': 'My Next Trip'})
      .success(function(response) {
        var newTripPlanId = response['trip_plans'][0]['trip_plan_id'];
        $scope.loadTripPlan(newTripPlanId)
      });
  };
}

function CarouselCtrl($scope) {
  var urls = $scope.entityModel.data['photo_urls'];
  var currentIndex = 0;
  $scope.currentImgUrl = urls[currentIndex];

  $scope.hasPrevImg = function() {
    return currentIndex > 0;
  };

  $scope.hasNextImg = function() {
    return currentIndex < (urls.length - 1);
  };

  $scope.nextImg = function() {
    currentIndex += 1;
    $scope.currentImgUrl = urls[currentIndex];
  };

  $scope.prevImg = function() {
    currentIndex -= 1;
    $scope.currentImgUrl = urls[currentIndex];
  };
}

function GuideViewCategoryCtrl($scope) {
  var me = this;
  $scope.entityModels = [];
  $scope.show = true;

  $.each($scope.planModel.entitiesForCategory($scope.category), function(i, entity) {
    $scope.entityModels.push(new EntityModel(entity));
  });

  $scope.hasEntities = function() {
    return $scope.entityModels && $scope.entityModels.length;
  };
}

function GuideViewCarouselCtrl($scope, $timeout) {
  var me = this;
  this.imgUrls = $scope.entityModel.data['photo_urls'];
  this.currentPage = 0;
  this.numImgsPerPage = 4;

  $scope.activeImgUrls = function() {
    var startIndex = me.currentPage * me.numImgsPerPage;
    var endIndex = startIndex + me.numImgsPerPage;
    return me.imgUrls.slice(startIndex, endIndex);
  };

  $scope.hasPrevImgs = function() {
    return me.currentPage > 0;
  };

  $scope.hasNextImgs = function() {
    return ((me.currentPage + 1) * me.numImgsPerPage) < me.imgUrls.length;
  };

  $scope.prevImgs = function() {
    me.currentPage -= 1;
    me.refreshMasonry();
  };

  $scope.nextImgs = function() {
    me.currentPage += 1;
    me.refreshMasonry();
  };

  this.refreshMasonry = function() {
    $timeout(function() {
      $scope.$broadcast('masonry.reload');
    });
  };
}

var SUB_CATEGORY_NAME_TO_ICON_URL = {
    'hotel': 'lodging_0star.png',
    'private_rental': 'lodging_0star.png',
    'bed_and_breakfast': 'lodging_0star.png',
    'hostel': 'lodging_0star.png',    
    'restaurant': 'restaurant.png',
    'bar': 'bar_coktail.png'
};

var CATEGORY_NAME_TO_ICON_URL = {
    'lodging': 'lodging_0star.png',
    'food_and_drink': 'restaurant.png',
    'attractions': 'sight-2.png'
};

function categoryToIconUrl(categoryName, subCategoryName, precision) {
  var iconUrl = '';
  if (subCategoryName) {
    iconUrl = SUB_CATEGORY_NAME_TO_ICON_URL[subCategoryName];
  } else if (categoryName) {
    iconUrl = CATEGORY_NAME_TO_ICON_URL[categoryName];
  }
  if (precision == 'Imprecise') {
    iconUrl = iconUrl.replace('.', '_imprecise.');
  }
  return iconUrl;
}

function DataRefreshManager($rootScope) {
  this.askToRefresh = function() {
    $rootScope.$broadcast('refreshdata');
  };
}

function AddPlaceCtrl($scope, $entityService, $timeout, $modal) {
  var me = this;
  $scope.loading = false;
  $scope.rawInputText = '';

  $scope.placeChanged = function(newPlace) {
    if (!newPlace || !newPlace['reference']) {
      return;
    }
    me.loadEntityByGooglePlaceReference(newPlace['reference']);
  };

  $scope.textPasted = function() {
    // Ugly hack to wrap this in a timeout; without it, the paste event
    // fires before the input has been populated with the pasted data.
    $timeout(function() {
      if (!$scope.rawInputText || !looksLikeUrl($scope.rawInputText)) {
        return;
      }
      me.loadEntityByUrl($scope.rawInputText);
    });
  };

  this.loadEntityByUrl = function(url) {
    $scope.loadingData = true;
    $entityService.urltoentity(url)
      .success(function(response) {
        var entity = response['entity'];
        if (entity) {
          me.openAddPlaceConfirmation(entity);
        }
        $scope.loadingData = false;
      });
  };

  this.loadEntityByGooglePlaceReference = function(reference) {
    $scope.loadingData = true;
    $entityService.googleplacetoentity(reference)
      .success(function(response) {
        var entity = response['entity'];
        if (entity) {
          me.openAddPlaceConfirmation(entity);
        }
        $scope.loadingData = false;
      });
  };

  this.openAddPlaceConfirmation = function(entityData) {
    $scope.omniboxState.visible = false;
    $scope.rawInputText = '';
    var scope = $scope.$new(true);
    scope.entityModel = new EntityModel(entityData);
    scope.ed = scope.entityModel.data;
    $modal.open({
      templateUrl: 'add-place-confirmation-template',
      scope: scope
    });
  };
}

function AddPlaceConfirmationCtrl($scope, $timeout, $entityService,
    $dataRefreshManager, $tripPlan, $datatypeValues) {
  var me = this;
  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];
  $scope.editingFields = $scope.isEditOfExistingEntity;

  this.makeMarker = function(entityData, map, draggable) {
    var latlngJson = entityData['latlng'] || {};
    var latlng = new google.maps.LatLng(
      latlngJson['lat'] || 0.0, latlngJson['lng'] || 0.0);
    return new google.maps.Marker({
      draggable: draggable,
      position: latlng,
      icon: '/static/img/' + entityData['icon_url'],
      map: map
    });
  };

  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 15,
    panControl: false,
    scaleControl: false,
    streetViewControl: false,
    mapTypeControl: false
  };
  var staticMap = new google.maps.Map($('#apc-static-map')[0], mapOptions);
  var editableMap = new google.maps.Map($('#apc-editable-map')[0], mapOptions);
  var staticMarker = this.makeMarker($scope.entityModel.data, staticMap, false);
  var editableMarker = this.makeMarker($scope.entityModel.data, editableMap, true);
  google.maps.event.addListener(editableMarker, 'dragend', function() {
    var entityData = $scope.entityModel.data;
    if (!entityData['latlng']) {
      entityData['latlng'] = {};
    }
    entityData['latlng']['lat'] = editableMarker.getPosition().lat();
    entityData['latlng']['lng'] = editableMarker.getPosition().lng();
  });
  $timeout(function() {
    google.maps.event.trigger(staticMap, 'resize');
    google.maps.event.trigger(editableMap, 'resize');
    staticMap.setCenter(staticMarker.getPosition());
    editableMap.setCenter(editableMarker.getPosition());    
  });

  $scope.openEditFields = function() {
    $scope.editingFields = true;
    $timeout(function(){
      google.maps.event.trigger(editableMap, 'resize');
      editableMap.setCenter(editableMarker.getPosition());      
    });
  };

  $scope.cancelConfirmation = function() {
    $scope.$close();
  };

  $scope.categoryChanged = function() {
    $scope.ed['sub_category'] = null;
    $scope.updateMarkerIcon();
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entityModel.data;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    $scope.entityModel.data['icon_url'] = iconUrl;
    editableMarker.setIcon('/static/img/' + iconUrl)
  };

  $scope.saveNewEntity = function() {
    $entityService.saveNewEntity($scope.entityModel.data, $tripPlan['trip_plan_id'])
      .success(me.handleSaveResponse)
      .error(function() {
        alert('Failed to save entity'); 
      });
  };

  $scope.saveChangesToExistingEntity = function() {
    $entityService.editEntity($scope.entityModel.data, $tripPlan['trip_plan_id'])
      .success(me.handleSaveResponse)
      .error(function() {
        alert('Failed to save entity');
      });
  };

  this.handleSaveResponse = function(response) {
    if (response['response_code'] != ResponseCode.SUCCESS) {
      alert('Failed to save entity');
    } else {
      $scope.$close();
      $dataRefreshManager.askToRefresh();
    }   
  };
}

function EditImagesCtrl($scope, $timeout) {
  var me = this;
  $scope.imgDragActive = false;
  var pasteActive = false;
  $scope.photoUrlInputText = ''
  var urls = $scope.entityModel.data['photo_urls'];
  if (!urls) {
    urls = $scope.entityModel.data['photo_urls'] = [];
  }
  var currentIndex = 0;
  $scope.currentImgUrl = urls.length ? urls[currentIndex] : '';

  $scope.$on('image-dropped', function(event, data) {
    var url = data['tc-drag-image-url'];
    if (url) {
      me.addImgUrl(url);
    }
  });

  $scope.photoUrlDragEnter = function($event) {
    $scope.imgDragActive = true;
  };

  $scope.photoUrlDropped = function($event) {
    var imgUrl = $event.originalEvent.dataTransfer.getData('text/uri-list');
    me.addImgUrl(imgUrl);
    $event.stopPropagation();
    $event.preventDefault();
    $scope.imgDragActive = false;
  };

  $scope.photoUrlPasted = function() {
    pasteActive = true;
    $timeout(function() {
      me.addImgUrl($scope.photoUrlInputText);
      $scope.photoUrlInputText = '';
      pasteActive = false;
    });
  };

  $scope.photoUrlChanged = function() {
    if (!pasteActive) {
      $scope.photoUrlInputText = '';
    }
  };

  this.addImgUrl = function(url) {
    if (url) {
      urls.splice(urls.length, 0, url);
      currentIndex = urls.length - 1;
      $scope.currentImgUrl = urls[currentIndex];
    }
  };

  $scope.removeActiveImg = function() {
    urls.splice(currentIndex, 1);
    if (currentIndex >= urls.length) {
      currentIndex = Math.max(urls.length - 1, 0);
    }
    $scope.currentImgUrl = urls[currentIndex];
  };

  $scope.hasPrevImg = function() {
    return currentIndex > 0;
  };

  $scope.hasNextImg = function() {
    return currentIndex < (urls.length - 1);
  };

  $scope.nextImg = function() {
    currentIndex += 1;
    $scope.currentImgUrl = urls[currentIndex];
  };

  $scope.prevImg = function() {
    currentIndex -= 1;
    $scope.currentImgUrl = urls[currentIndex];
  };
}


function removeElemByValue(arr, value) {
  for (var i = 0, I = arr.length; i < I; i++) {
    if (arr[i] === value) {
      arr.splice(i, 1);
      return i;
    }
  }
  return null;
}

function DayPlannerItemModel(data) {
  this.data = data;

  this.day = function() {
    return data['day'];
  };

  this.setDay = function(day) {
    this.data['day'] = day;
  };

  this.position = function() {
    return this.data['day_position'];
  };

  this.setPosition = function(dayPosition) {
    this.data['day_position'] = dayPosition;
  };

  this.isEntity = function() {
    return !!this.data['entity_id'];
  };

  this.isNote = function() {
    return !!this.data['note_id'];
  };

  this.hasPositionInfo = function() {
    return this.day() > 0 && this.position() >= 0;
  };

  this.clearPosition = function() {
    this.setDay(-1);
    this.setPosition(-1);
  };
}

function DayPlannerDayModel(dayNumber) {
  this.dayNumber = dayNumber;
  this.items = [];
  this.noteItem = new DayPlannerItemModel({
    'day': dayNumber,
    'text': ''
  });

  this.addItem = function(item, position) {
    if (!position && !_.isNumber(position)) {
      position = this.items.length;
    }
    item.setDay(this.dayNumber);
    this.items.splice(position, 0, item);
    this.recalculatePositions();
  };

  this.setNote = function(noteItem) {
    this.noteItem = noteItem;
  };

  this.recalculatePositions = function() {
    $.each(this.items, function(i, item) {
      item.setPosition(i);
    });
  };

  this.removeItem = function(item) {
    if (item.day() != dayNumber) {
      throw 'Asked to remove an item from the wrong day.'
    }
    this.items.splice(item.position(), 1);
    this.recalculatePositions();
  };

  this.reorderItem = function(item, newPosition) {
    this.items.splice(item.position(), 1);
    this.addItem(item, newPosition);
  };

  this.getItems = function() {
    return this.items;
  };

  this.clear = function() {
    $.each(this.items, function(i, item) {
      item.clearPosition();
    });
    var clearedItems = this.items;
    this.items = [];
    this.noteItem.data['text'] = '';
    return clearedItems;
  };
}

function DayPlannerModel(orderedItems, unorderedItems, noteItems) {
  var me = this;
  this.dayModels = [];
  this.unorderedItems = unorderedItems;

  this.dayModelForDay = function(dayNumber /* 1-indexed */) {
    var dayIndex = dayNumber - 1;
    if (dayIndex < this.dayModels.length && this.dayModels[dayIndex]) {
      return this.dayModels[dayIndex];
    } else {
      var dayModel = new DayPlannerDayModel(dayNumber);
      this.dayModels[dayIndex] = dayModel;
      return dayModel;
    }
  };

  $.each(orderedItems, function(i, item) {
    me.dayModelForDay(item.day()).addItem(item);
  });
  $.each(noteItems, function(i, noteItem) {
    me.dayModelForDay(noteItem.day()).setNote(noteItem);
  });

  this.addNewDay = function() {
    return this.dayModelForDay(this.dayModels.length + 1);
  };
  $.each(this.dayModels, function(i, dayModel) {
    if (!dayModel) {
      me.dayModelForDay(i + 1);
    }
  });

  this.organizeItem = function(item, dayNumber, position) {
    if (item.day() == dayNumber && item.position() == position) {
      return;
    }

    if (item.day() && item.day() > 0) {
      if (item.day() == dayNumber) {
        this.dayModelForDay(dayNumber).reorderItem(item, position);
      } else {
        this.dayModelForDay(item.day()).removeItem(item);
        this.dayModelForDay(dayNumber).addItem(item, position);
      }
    } else {
      removeElemByValue(this.unorderedItems, item);
      this.dayModelForDay(dayNumber).addItem(item, position);
    }
  };

  this.clearDay = function(dayModel) {
    var clearedItems = dayModel.clear();
    this.unorderedItems.push.apply(this.unorderedItems, clearedItems);
  };

  this.clearItem = function(itemModel) {
    this.dayModelForDay(itemModel.day()).removeItem(itemModel);
    itemModel.clearPosition();
    this.unorderedItems.push(itemModel);
  };

  this.allOrderedItems = function() {
    return _.flatten(_.map(this.dayModels, function(dayModel) {
      return dayModel.getItems();
    }));
  };

  // Items that were previously ordered that the user decided to un-order.
  this.purposelyUnorderedItems = function() {
    return _.filter(this.unorderedItems, function(item) {
      return item.day() < 0 || item.position() < 0;
    });
  };

  this.allNoteItems = function() {
    return _.map(this.dayModels, function(dayModel) {
      return dayModel.noteItem;
    });
  };
}

function DayPlannerDropTargetCtrl($scope) {
  var me = this;
  $scope.dragover = false;

  $scope.isDragActive = function() {
    return me.isValidDropTarget();
  };

  $scope.onDragenter = function($event) {
    if (me.isValidDropTarget()) {
      $scope.dragover = true;
      $event.preventDefault();
    }
  };

  $scope.onDragleave = function() {
    $scope.dragover = false;
  };

  $scope.onDragover = function($event) {
    if ($scope.isDragActive()) {
      $event.preventDefault();
    }
  };

  $scope.dropDone = function($event) {
    $event.preventDefault();
    $event.stopPropagation();
    $scope.dragover = false;
  };

  this.isValidDropTarget = function() {
    if (!$scope.dragItem) {
      return false;
    }
    if (!_.isNumber($scope.dragItem.position())
      || !_.isNumber($scope.dragItem.day())
      || $scope.dragItem.day() < 0
      || $scope.dragItem.position() < 0) {
      return true;
    }
    if ($scope.dragItem.day() != $scope.day) {
      return true;
    }
    if ($scope.dragItem.position() == $scope.position || ($scope.dragItem.position() + 1 == $scope.position)) {
      return false;
    }
    return true;
  };
}

function DayPlannerOneDayCtrl($scope) {
  $scope.editingNote = false;
}

function DayPlannerDraggableEntityCtrl($scope) {
  $scope.activeItemIsThis = function(itemModel) {
    return $scope.dragItem && $scope.dragItem === itemModel;
  };
}

function DayPlannerCtrl($scope, $entityService, $noteService, $tripPlanModel) {
  var me = this;
  var unorderedItems = [];
  var orderedItems = [];
  $.each($tripPlanModel.entityDatas, function(i, entity) {
    var item = new DayPlannerItemModel(angular.copy(entity));
    if (item.day()) {
      orderedItems.push(item);
    } else {
      unorderedItems.push(item);
    }
  });
  var noteItems = $.map($tripPlanModel.notes, function(note) {
    return new DayPlannerItemModel(angular.copy(note));
  });

  $scope.dayPlannerModel = new DayPlannerModel(orderedItems, unorderedItems, noteItems);
  $scope.dpm = $scope.dayPlannerModel;
  $scope.unorderedItems = unorderedItems;
  $scope.dragItem = null;
  $scope.dragactive = false;
  $scope.leftPanelDragover = false;

  $scope.addNewDay = function() {
    $scope.dayPlannerModel.addNewDay();
  };

  $scope.onDragstart = function($event, item) {
    $scope.dragactive = true;
    $scope.dragItem = item;
  };

  $scope.onDragend = function() {
    $scope.dragactive = false;
    $scope.dragItem = null;
  };

  $scope.handleDrop = function(dayNumber, position) {
    var item = $scope.dragItem;
    $scope.dragactive = false;
    $scope.dragItem = null;
    $scope.dayPlannerModel.organizeItem(item, dayNumber, position || 0);
  };

  $scope.activeItemIsThis = function(itemModel) {
    return $scope.dragItem && $scope.dragItem === itemModel;
  };

  $scope.onLeftPanelDragenter = function($event) {
    if ($scope.showLeftPanelDragActive()) {
      $event.preventDefault();
    }
  };

  $scope.onLeftPanelDragover = function($event) {
    $scope.leftPanelDragover = true;
    if ($scope.showLeftPanelDragover()) {
      $event.preventDefault();
    }
  };

  $scope.showLeftPanelDragActive = function() {
    return $scope.dragItem && $scope.dragItem.hasPositionInfo();
  };

  $scope.showLeftPanelDragover = function() {
    return $scope.leftPanelDragover && $scope.showLeftPanelDragActive();
  };

  $scope.handleLeftPanelDrop = function($event) {
    $event.preventDefault();
    $event.stopPropagation();
    $scope.dayPlannerModel.clearItem($scope.dragItem);
    $scope.leftPanelDragover = false;
    $scope.onDragend();
  };

  $scope.saveOrderings = function() {
    var allItemsToSave = $scope.dayPlannerModel.allOrderedItems()
      .concat($scope.dayPlannerModel.purposelyUnorderedItems());
    var entityItems = _.filter(allItemsToSave, function(item) { return item.isEntity(); });
    var entitiesWithOnlyOrderingChanges = _.map(entityItems, function(item) {
      return {
        'entity_id': item.data['entity_id'],
        'day': item.day(),
        'day_position': item.position()
      };
    });
    var operations = _.map(entitiesWithOnlyOrderingChanges, function(entity) {
      return $entityService.operationFromEntity(
        entity, $tripPlanModel.tripPlanId(), Operator.EDIT);
    });
    var request = {'operations': operations};
    $entityService.mutate(request)
      .success(function(response) {
        var modifiedEntities = response['entities'];
        $tripPlanModel.updateEntities(modifiedEntities);
        $tripPlanModel.updateLastModified(response['last_modified']);
        me.saveNotes($scope.$close);
      });
  };

  this.saveNotes = function(opt_callback) {
    var allNotes = _.map($scope.dayPlannerModel.allNoteItems(), function(item) { return item.data; });
    var operations = [];
    var tripPlanId = $tripPlanModel.tripPlanId();
    $.each(allNotes, function(i, note) {
      if (note['note_id']) {
        operations.push($noteService.operationFromNote(note, tripPlanId, Operator.EDIT));
      } else if (!note['note_id'] && note['text']) {
        operations.push($noteService.operationFromNote(note, tripPlanId, Operator.ADD));
      }
    });
    if (!operations.length) {
      opt_callback && opt_callback()
      return;
    }
    var request = {'operations': operations};
    $noteService.mutate(request)
      .success(function(response) {
        var modifiedNotes = response['notes'];
        $tripPlanModel.updateNotes(modifiedNotes);
        $tripPlanModel.updateLastModified(response['last_modified']);
        opt_callback && opt_callback();
      });
  };
}

// Directives

function tcScrollToOnClick($parse) {
  return {
      restrict: 'AEC',
      link: function(scope, elem, attrs) {
        var getScrollToIdFn = $parse(attrs.tcScrollToOnClick);
        if (getScrollToIdFn) {
          elem.on('click', function() {
            var scrollToId = getScrollToIdFn(scope);
            $('html, body').animate({
              scrollTop: ($("#" + scrollToId).offset().top - 73)
            }, 500);
          });
        }
      }
  };
}

function tcStarRating() {
  return {
    restrict: 'AEC',
    scope: {
      value: '=value'
    },
    templateUrl: 'star-rating-template'
  };
}

function tcFocusOn() {
  return {
    restrict: 'A',
    scope: {
      focusValue: '=tcFocusOn'
    },
    link: function(scope, element, attrs) {
      scope.$watch('focusValue', function(currentValue, previousValue) {
        if (currentValue) {
          element[0].focus();
        }
      });
    }
  };
}

function tcTripPlanSelectDropdown() {
  return {
    restrict: 'AE',
    templateUrl: 'trip-plan-select-dropdown-template',
    controller: TripPlanSelectDropdownCtrl,
    scope: {
      selectedTripPlan: '=selectTripPlanTo'
    }
  };
}

function tcItemDropTarget() {
  return {
    restrict: 'AE',
    templateUrl: 'day-planner-drop-target-template',
    controller: DayPlannerDropTargetCtrl,
    scope: {
      day: '=',
      position: '=',
      dragItem: '=',
      onDrop: '&'
    }
  };
}

function tcDraggableEntity() {
  return {
    restrict: 'AE',
    templateUrl: 'day-planner-entity-item-template',
    controller: DayPlannerDraggableEntityCtrl,
    scope: {
      item: '=',
      dragItem: '=',
      onDragstart: '&',
      onDragend: '&'
    }
  };
}

function bnLazySrc( $window, $document, $rootScope ) {
    // I manage all the images that are currently being
    // monitored on the page for lazy loading.
    var lazyLoader = (function() {

        // I maintain a list of images that lazy-loading
        // and have yet to be rendered.
        var images = [];

        // I define the render timer for the lazy loading
        // images to that the DOM-querying (for offsets)
        // is chunked in groups.
        var renderTimer = null;
        var renderDelay = 100;

        // I cache the window element as a jQuery reference.
        var win = $( $window );

        // I cache the document document height so that
        // we can respond to changes in the height due to
        // dynamic content.
        var doc = $document;
        var documentHeight = doc.height();
        var documentTimer = null;
        var documentDelay = 2000;

        // I determine if the window dimension events
        // (ie. resize, scroll) are currenlty being
        // monitored for changes.
        var isWatchingWindow = false;

        // PUBLIC METHODS.

        // I start monitoring the given image for visibility
        // and then render it when necessary.
        function addImage( image ) {
            images.push( image );
            if ( ! renderTimer ) {
                startRenderTimer();
            }

            if ( ! isWatchingWindow ) {
                startWatchingWindow();
            }
        }

        // I remove the given image from the render queue.
        function removeImage( image ) {
            // Remove the given image from the render queue.
            for ( var i = 0 ; i < images.length ; i++ ) {
                if ( images[ i ] === image ) {
                    images.splice( i, 1 );
                    break;
                }
            }

            // If removing the given image has cleared the
            // render queue, then we can stop monitoring
            // the window and the image queue.
            if ( ! images.length ) {
                clearRenderTimer();
                stopWatchingWindow();
            }
        }

        // PRIVATE METHODS.

        // I check the document height to see if it's changed.
        function checkDocumentHeight() {
            // If the render time is currently active, then
            // don't bother getting the document height -
            // it won't actually do anything.
            if ( renderTimer ) {
                return;
            }

            var currentDocumentHeight = doc.height();

            // If the height has not changed, then ignore -
            // no more images could have come into view.
            if ( currentDocumentHeight === documentHeight ) {
                return;
            }
            // Cache the new document height.
            documentHeight = currentDocumentHeight;
            startRenderTimer();
        }

        // I check the lazy-load images that have yet to
        // be rendered.
        function checkImages() {
            // Log here so we can see how often this
            // gets called during page activity.
            // console.log( "Checking for visible images..." );

            var visible = [];
            var hidden = [];

            // Determine the window dimensions.
            var windowHeight = win.height();
            var scrollTop = win.scrollTop();

            // Calculate the viewport offsets.
            var topFoldOffset = scrollTop;
            var bottomFoldOffset = ( topFoldOffset + windowHeight );

            // Query the DOM for layout and seperate the
            // images into two different categories: those
            // that are now in the viewport and those that
            // still remain hidden.
            for ( var i = 0 ; i < images.length ; i++ ) {
                var image = images[ i ];
                if ( image.isVisible( topFoldOffset, bottomFoldOffset ) ) {
                    visible.push( image );
                } else {
                    hidden.push( image );
                }
            }

            // Update the DOM with new image source values.
            for ( var i = 0 ; i < visible.length ; i++ ) {
                visible[ i ].render();
            }

            // Keep the still-hidden images as the new
            // image queue to be monitored.
            images = hidden;

            // Clear the render timer so that it can be set
            // again in response to window changes.
            clearRenderTimer();

            // CUSTOM HOOK
            // Broadcast to the masonry code that it should
            // adjust the layout now that new images have loaded.
            $rootScope.$broadcast('masonry.reload');

            // If we've rendered all the images, then stop
            // monitoring the window for changes.
            if ( ! images.length ) {
                stopWatchingWindow();
            }
        }

        // I clear the render timer so that we can easily
        // check to see if the timer is running.
        function clearRenderTimer() {
            clearTimeout( renderTimer );
            renderTimer = null;
        }

        // I start the render time, allowing more images to
        // be added to the images queue before the render
        // action is executed.
        function startRenderTimer() {
            renderTimer = setTimeout( checkImages, renderDelay );
        }

        // I start watching the window for changes in dimension.
        function startWatchingWindow() {
            isWatchingWindow = true;

            // Listen for window changes.
            win.on( "resize.bnLazySrc", windowChanged );
            win.on( "scroll.bnLazySrc", windowChanged );

            // Set up a timer to watch for document-height changes.
            documentTimer = setInterval( checkDocumentHeight, documentDelay );
        }

        // I stop watching the window for changes in dimension.
        function stopWatchingWindow() {
            isWatchingWindow = false;

            // Stop watching for window changes.
            win.off( "resize.bnLazySrc" );
            win.off( "scroll.bnLazySrc" );

            // Stop watching for document changes.
            clearInterval( documentTimer );
        }

        // I start the render time if the window changes.
        function windowChanged() {
            if ( ! renderTimer ) {
                startRenderTimer();
            }
        }

        // Return the public API.
        return ({
            addImage: addImage,
            removeImage: removeImage
        });

    })();

    // ------------------------------------------ //

    // I represent a single lazy-load image.
    function LazyImage( element ) {
        // I am the interpolated LAZY SRC attribute of
        // the image as reported by AngularJS.
        var source = null;

        // I determine if the image has already been
        // rendered (ie, that it has been exposed to the
        // viewport and the source had been loaded).
        var isRendered = false;

        // I am the cached height of the element. We are
        // going to assume that the image doesn't change
        // height over time.
        var height = null;

        // PUBLIC METHODS.

        // I determine if the element is above the given
        // fold of the page.
        function isVisible( topFoldOffset, bottomFoldOffset ) {
            // If the element is not visible because it
            // is hidden, don't bother testing it.
            if ( ! element.is( ":visible" ) ) {
                return( false );
            }

            // If the height has not yet been calculated,
            // the cache it for the duration of the page.
            if ( height === null ) {
                height = element.height();
            }

            // Update the dimensions of the element.
            var top = element.offset().top;
            var bottom = ( top + height );

            // Return true if the element is:
            // 1. The top offset is in view.
            // 2. The bottom offset is in view.
            // 3. The element is overlapping the viewport.
            return(
                    (
                        ( top <= bottomFoldOffset ) &&
                        ( top >= topFoldOffset )
                    )
                ||
                    (
                        ( bottom <= bottomFoldOffset ) &&
                        ( bottom >= topFoldOffset )
                    )
                ||
                    (
                        ( top <= topFoldOffset ) &&
                        ( bottom >= bottomFoldOffset )
                    )
            );
        }

        // I move the cached source into the live source.
        function render() {
            isRendered = true;
            renderSource();
        }

        // I set the interpolated source value reported
        // by the directive / AngularJS.
        function setSource( newSource ) {
            source = newSource;
            if ( isRendered ) {
                renderSource();
            }
        }

        // PRIVATE METHODS.

        // I load the lazy source value into the actual
        // source value of the image element.
        function renderSource() {
            element[ 0 ].src = source;
        }

        // Return the public API.
        return ({
            isVisible: isVisible,
            render: render,
            setSource: setSource
        });

    }

    // ------------------------------------------ //

    // I bind the UI events to the scope.
    function link( $scope, element, attributes ) {
        var lazyImage = new LazyImage( element );
        // Start watching the image for changes in its
        // visibility.
        lazyLoader.addImage( lazyImage );
        // Since the lazy-src will likely need some sort
        // of string interpolation, we don't want to
        attributes.$observe(
            "bnLazySrc",
            function( newSource ) {
                lazyImage.setSource( newSource );
            }
        );

        // When the scope is destroyed, we need to remove
        // the image from the render queue.
        $scope.$on(
            "$destroy",
            function() {
                lazyLoader.removeImage( lazyImage );
            }
        );
    }
    // Return the directive configuration.
    return({
        link: link,
        restrict: "A"
    });
}

function tcGooglePlaceAutocomplete($parse) {
  return {
    link: function(scope, element, attrs, model) {
      var placeChangeFn = $parse(attrs.onPlaceChange);
      var options = {
        types: [],
        componentRestrictions: {}
      };
      var gPlace = new google.maps.places.Autocomplete(element[0], options);

      google.maps.event.addListener(gPlace, 'place_changed', function() {
        if (placeChangeFn) {
          placeChangeFn(scope, {$newPlace: gPlace.getPlace()});
        };
      });

    }
  };
}

// Changes an event name like 'dragstart' to 'tcDragstart'
// Doesn't yet handle dashes and underscores.
function normalizeEventName(name, opt_prefix) {
  var prefix = opt_prefix || 'tc';
  return prefix + name.charAt(0).toUpperCase() + name.slice(1);
}

function directiveForEvent(eventName) {
  var normalizedEventName = normalizeEventName(eventName);
  return function($parse) {
    return {
      restrict: 'AEC',
      link: function(scope, elem, attrs) {
        var onEventFn = $parse(attrs[normalizedEventName]);
        elem.on(eventName, function(event) {
          scope.$apply(function() {
            onEventFn(scope, {$event: event});
          });
        });
      }
    };
  }
}

function interpolator($interpolateProvider) {
  $interpolateProvider.startSymbol('[[');
  $interpolateProvider.endSymbol(']]');
}

angular.module('directivesModule', [])
  .directive('tcScrollToOnClick', tcScrollToOnClick)
  .directive('tcStarRating', tcStarRating)
  .directive('bnLazySrc', bnLazySrc)
  .directive('tcGooglePlaceAutocomplete', tcGooglePlaceAutocomplete)
  .directive('tcDrop', directiveForEvent('drop'))
  .directive('tcDragenter', directiveForEvent('dragenter'))
  .directive('tcDragstart', directiveForEvent('dragstart'))
  .directive('tcDragleave', directiveForEvent('dragleave'))
  .directive('tcDragover', directiveForEvent('dragover'))
  .directive('tcDragend', directiveForEvent('dragend'))
  .directive('tcFocusOn', tcFocusOn)
  .directive('tcTripPlanSelectDropdown', tcTripPlanSelectDropdown);

angular.module('filtersModule', [])
  .filter('hostname', function() {
    return function(input) {
      return hostnameFromUrl(input);
    }
  });

window['initApp'] = function(tripPlan, entities, notes, allTripPlans,
    accountInfo, datatypeValues, allowEditing) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanModel', new TripPlanModel(tripPlan, entities, notes))
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues)
    .value('$accountInfo', accountInfo)
    .value('$allowEditing', allowEditing);

  angular.module('mapModule', [])
    .value('$map', createMap())
    .value('$mapBounds', new google.maps.LatLngBounds());

  angular.module('appModule', ['mapModule', 'initialDataModule', 'servicesModule',
      'directivesModule', 'filtersModule', 'ui.bootstrap', 'wu.masonry'],
      interpolator)
    .controller('RootCtrl', ['$scope', '$http', '$timeout', '$modal',
      '$tripPlanService', '$tripPlanModel', '$tripPlan', '$entityService',
      '$datatypeValues', '$allowEditing', RootCtrl])
    .controller('AccountDropdownCtrl', ['$scope', '$http', '$tripPlanService', '$accountInfo',
      '$tripPlan', '$allTripPlans', AccountDropdownCtrl])
    .controller('CategoryCtrl', ['$scope', '$map', '$mapBounds', '$entityService',
      '$templateToStringRenderer', '$tripPlan', '$allowEditing', CategoryCtrl])
    .controller('EntityCtrl', ['$scope', '$entityService', '$modal',
      '$dataRefreshManager', '$tripPlan', EntityCtrl])
    .controller('ReclipConfirmationCtrl', ['$scope', '$timeout', '$entityService', ReclipConfirmationCtrl])
    .controller('NavigationCtrl', ['$scope', '$location', '$anchorScroll', NavigationCtrl])
    .controller('CarouselCtrl', ['$scope', CarouselCtrl])
    .controller('GuideViewCategoryCtrl', ['$scope', GuideViewCategoryCtrl])
    .controller('GuideViewCarouselCtrl', ['$scope', '$timeout', GuideViewCarouselCtrl])
    .controller('AddPlaceCtrl', ['$scope', '$entityService', '$timeout', '$modal', AddPlaceCtrl])
    .controller('AddPlaceConfirmationCtrl', ['$scope','$timeout', '$entityService',
      '$dataRefreshManager', '$tripPlan', '$datatypeValues', AddPlaceConfirmationCtrl])
    .controller('EditImagesCtrl', ['$scope', '$timeout', EditImagesCtrl])
    .controller('DayPlannerCtrl', ['$scope', '$entityService', '$noteService', '$tripPlanModel', DayPlannerCtrl])
    .controller('DayPlannerOneDayCtrl', ['$scope', DayPlannerOneDayCtrl])
    .directive('tcItemDropTarget', tcItemDropTarget)
    .directive('tcDraggableEntity', tcDraggableEntity)
    .service('$templateToStringRenderer', TemplateToStringRenderer)
    .service('$dataRefreshManager', DataRefreshManager);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};

function ClipperStateModel(initialStatus) {
  this.status = initialStatus;

  this.newEntitySummary = function() {
    return this.status == ClipperStateModel.SUMMARY;
  };

  this.inEdit = function() {
    return this.status == ClipperStateModel.EDIT;
  };

  this.successConfirmation = function() {
    return this.status == ClipperStateModel.SUCCESS_CONFIRMATION;
  };

  this.noAutoPlaceFound = function() {
    return this.status == ClipperStateModel.NO_AUTO_PLACE_FOUND;
  };

  this.clipError = function() {
    return this.status == ClipperStateModel.CLIP_ERROR;
  };

  this.waitingForScrapeFromPageSource = function() {
    return this.status == ClipperStateModel.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE;
  };

  this.showControls = function() {
    return this.status == ClipperStateModel.SUMMARY
      || this.status == ClipperStateModel.EDIT
      || this.status == ClipperStateModel.NO_AUTO_PLACE_FOUND;
  };
}

ClipperStateModel.SUMMARY = 1;
ClipperStateModel.EDIT = 2;
ClipperStateModel.SUCCESS_CONFIRMATION = 3;
ClipperStateModel.NO_AUTO_PLACE_FOUND = 4;
ClipperStateModel.CLIP_ERROR = 5;
ClipperStateModel.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE = 6;

function ClipperRootCtrl($scope, $http, $timeout, $entityService,
    $needsPageSource, $entity, $allTripPlans, $datatypeValues) {
  var me = this;

  $scope.selectedTripPlanState = {
    tripPlan: null
  };

  this.prepareEntityState = function(entityData) {
    var foundEntity = false;
    if ($.isEmptyObject(entityData)) {
      $scope.entityModel = new EntityModel({});
    } else {
      $scope.entityModel = new EntityModel(entityData);
      foundEntity = true;
    }
    $scope.ed = $scope.entityModel.data;
    $scope.clipperState = new ClipperStateModel(
      foundEntity ? ClipperStateModel.SUMMARY : ClipperStateModel.NO_AUTO_PLACE_FOUND);
  };

  if ($needsPageSource) {
    $(window).on('message', function(event) {
      if (!event.originalEvent.data['message'] == 'tc-page-source') {
        return;
      }
      var pageSource = event.originalEvent.data['data'];
      $entityService.pagesourcetoentity(getParameterByName('url'), pageSource)
        .success(function(response) {
          me.prepareEntityState(response['entity']);
        });
    });
    window.parent.postMessage('tc-needs-page-source', '*'); 
    $scope.clipperState = new ClipperStateModel(ClipperStateModel.WAITING_FOR_SCRAPE_FROM_PAGE_SOURCE);
  } else {
    this.prepareEntityState($entity); 
  }

  $scope.categories = $datatypeValues['categories'];
  $scope.subCategories = $datatypeValues['sub_categories'];

  $(window).on('message', function(event) {
    $scope.$apply(function(){
      if (event.originalEvent.data['message'] == 'tc-image-dropped') {
        $scope.$broadcast('image-dropped', event.originalEvent.data['data']);
      }
    });
  });

  $scope.showSaveControls = function() {
    return !$scope.selectedTripPlanState.tripPlan
      || $scope.selectedTripPlanState.tripPlan['trip_plan_id'] > 0;
  };

  $scope.saveable = function() {
    var tripPlanId = $scope.selectedTripPlanState.tripPlan
      && $scope.selectedTripPlanState.tripPlan['trip_plan_id'];
    return tripPlanId && tripPlanId != 0 && $scope.ed['name'];
  };

  $scope.saveEntity = function() {
    $entityService.saveNewEntity($scope.ed, $scope.selectedTripPlanState.tripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.clipperState.status = ClipperStateModel.SUCCESS_CONFIRMATION;
          $timeout($scope.dismissClipper, 3000);
        } else {
          $scope.clipperState.status = ClipperStateModel.CLIP_ERROR;
        }
      }).error(function(response) {
       $scope.clipperState.status = ClipperStateModel.CLIP_ERROR;
      });
  };

  $scope.openEditor = function() {
    $scope.clipperState.status = ClipperStateModel.EDIT;
  };

  $scope.openEditorWithEntity = function(entityData) {
    $scope.entityModel = new EntityModel(entityData);
    $scope.ed = entityData;
    $scope.openEditor();
  };

  $scope.dismissClipper = function() {
    window.parent.postMessage('tc-close-clipper', '*');
  };
}

function ClipperOmniboxCtrl($scope, $entityService) {
  var me = this;
  $scope.loadingData = false;
  $scope.entityNotFound = false;
  $scope.rawInputText = '';

  $scope.placeChanged = function(newPlace) {
    if (!newPlace || !newPlace['reference']) {
      return;
    }
    me.loadEntityByGooglePlaceReference(newPlace['reference']);
  };

  $scope.openEditManually = function() {
    // This is a method defined on the parent scope, not ideal.    
    $scope.openEditor();
  };

  this.loadEntityByGooglePlaceReference = function(reference) {
    $scope.loadingData = true;
    $entityService.googleplacetoentity(reference)
      .success(function(response) {
        var entity = response['entity'];
        if (entity) {
          var sourceUrl = getParameterByName('url');
          entity['source_url'] = sourceUrl;
          // This is a method defined on the parent scope, not ideal.
          $scope.openEditorWithEntity(entity);
        } else {
          $scope.entityNotFound = true;
        }
        $scope.loadingData = false;
        $scope.rawInputText = '';
      });
  };
}

function ClipperEditorCtrl($scope, $timeout) {

  this.makeMarker = function(entityData, map) {
    var latlngJson = entityData['latlng'] || {};
    var latlng = new google.maps.LatLng(
      latlngJson['lat'] || 0.0, latlngJson['lng'] || 0.0);
    return new google.maps.Marker({
      draggable: true,
      position: latlng,
      icon: '/static/img/' + entityData['icon_url'],
      map: map
    });
  };

  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 15,
    panControl: false,
    scaleControl: false,
    streetViewControl: false,
    mapTypeControl: false
  };
  var editableMap = new google.maps.Map($('#clipper-editor-map')[0], mapOptions);
  var editableMarker = this.makeMarker($scope.entityModel.data, editableMap);
  google.maps.event.addListener(editableMarker, 'dragend', function() {
    var entityData = $scope.entityModel.data;
    if (!entityData['latlng']) {
      entityData['latlng'] = {};
    }
    entityData['latlng']['lat'] = editableMarker.getPosition().lat();
    entityData['latlng']['lng'] = editableMarker.getPosition().lng();
  });
  $timeout(function() {
    google.maps.event.trigger(editableMap, 'resize');
    editableMap.setCenter(editableMarker.getPosition());    
  });

  $scope.categoryChanged = function() {
    $scope.ed['sub_category'] = null;
    $scope.updateMarkerIcon();
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entityModel.data;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    $scope.entityModel.data['icon_url'] = iconUrl;
    editableMarker.setIcon('/static/img/' + iconUrl)
  };
}

window['initClipper'] = function(entity, needsPageSource,
    allTripPlans, datatypeValues) {
  angular.module('clipperInitialDataModule', [])
    .value('$entity', entity)
    .value('$needsPageSource', needsPageSource)
    .value('$allTripPlans', allTripPlans)
    .value('$datatypeValues', datatypeValues);

  angular.module('clipperModule',
      ['clipperInitialDataModule', 'directivesModule', 'filtersModule', 'servicesModule'],
      interpolator)
    .controller('ClipperRootCtrl', ['$scope', '$http', '$timeout', '$entityService',
      '$needsPageSource', '$entity', '$allTripPlans', '$datatypeValues', ClipperRootCtrl])
    .controller('CarouselCtrl', ['$scope', CarouselCtrl])
    .controller('ClipperOmniboxCtrl', ['$scope', '$entityService', ClipperOmniboxCtrl])
    .controller('ClipperEditorCtrl', ['$scope', '$timeout', ClipperEditorCtrl])
    .controller('EditImagesCtrl', ['$scope', '$timeout', EditImagesCtrl]);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['clipperModule']);
  });
};
