function hostnameFromUrl(url) {
  var fullHost = $('<a>').attr('href', url)[0].hostname;
  if (fullHost.substring(0, 4) == 'www.') {
    return fullHost.substring(4);
  }
  return fullHost;
}

function hostNoSuffix(url) {
  var host = hostnameFromUrl(url);
  return host.split('.')[0];
}

function emailPrefix(email) {
  return email.split('@')[0];
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

function removeElemByValue(arr, value) {
  for (var i = 0, I = arr.length; i < I; i++) {
    if (arr[i] === value) {
      arr.splice(i, 1);
      return i;
    }
  }
  return null;
}

function isWhitespace(str) {
  return /^\s+$/.test(str);
}

var HOST_TO_ICON = {
  'foursquare.com': 'https://foursquare.com/img/touch-icon-ipad-retina.png'
};
  

function hostToIcon(host) {
  var iconOverride = HOST_TO_ICON[host];
  return iconOverride || 'http://' + host + '/favicon.ico';
}

function EntityModel(entityData, editable) {
  this.data = entityData;

  this.entityId = function() {
    return this.data['entity_id'];
  };

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
    var latlng = this.gmapsLatLng();
    var entityName = entity['name'];
    var markerData = {
      position: latlng,
      map: null,
      title: entityName,
      icon: '/static/img/map-icons/' + entity['icon_url'],
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

  this.gmapsLatLng = function() {
    return new google.maps.LatLng(this.data['latlng']['lat'], this.data['latlng']['lng']);
  };

  this.marker = this.makeMarker();
  this.infowindow = null;
}

function TripPlanModel(tripPlanData, entityDatas, notes) {
  var me = this;

  this.resetEntities = function(entities) {
    this.entitiesById = dictByAttr(entities, 'entity_id');
    this.entityDatas = entities || [];
    if (this.dayPlannerModel) {
      this.dayPlannerModel.reset(this.entityItemCopies(), this.noteItemCopies());
    }
  };

  this.tripPlanData = tripPlanData;
  this.notes = notes || [];
  this.resetEntities(entityDatas);

  this.allItems = function() {
    return _.map(this.entityDatas.concat(this.notes), function(data) {
      return new ItemModel(data);
    });
  };

  this.entityItems = function() {
    return _.map(this.entityDatas, function(data) {
      return new ItemModel(data);
    });
  };

  this.entityItemCopies = function() {
    return _.map(this.entityDatas, function(data) {
      return new ItemModel(angular.copy(data));
    });
  };

  this.noteItems = function() {
    return _.map(this.notes, function(note) {
      return new ItemModel(note);
    });
  };

  this.noteItemCopies = function() {
    return _.map(this.notes, function(note) {
      return new ItemModel(angular.copy(note));
    });
  };

  // TODO: Remove
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

  this.numEntities = function() {
    return this.entityDatas ? this.entityDatas.length : 0;
  };

  this.hasLocation = function() {
    return !!this.tripPlanData['location_bounds'];
  };

  this.tripPlanId = function() {
    return this.tripPlanData['trip_plan_id'];
  };

  this.tripPlanName = function() {
    return this.tripPlanData['name'];
  };

  this.demoQueryString = function() {
    return escape(this.tripPlanData['location_name']);
  };

  this.hasCoverImage = function() {
    return !!this.tripPlanData['cover_image_url'];
  };

  this.hasOverview = function() {
    return this.hasCoverImage() || this.tripPlanData['description'];
  };

  this.hasSource = function() {
    return !!this.tripPlanData['source_url'];
  };

  this.creatorIsUser = function() {
    return this.tripPlanData['creator'] && this.tripPlanData['creator'].indexOf('@') > -1;
  };

  this.locationLatlng = function() {
    return this.tripPlanData['location_latlng'];
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
    this.dayPlannerModel.reset(this.entityItemCopies(), this.noteItemCopies());
  };

  this.updateNotes = function(noteDatas) {
    var newNotesById = dictByAttr(noteDatas, 'note_id');
    for (var i = this.notes.length - 1; i >= 0; i--) {
      var noteId = this.notes[i]['note_id'];
      var updatedNote = newNotesById[noteId];
      if (updatedNote) {
        if (updatedNote['status'] == 'DELETED') {
          this.notes.splice(i, 1);
        } else {
          this.notes[i] = updatedNote;
        }
        delete newNotesById[noteId];
      };
    }
    // Any leftover values are new notes, so we should append them.
    this.notes.push.apply(this.notes, _.values(newNotesById));

    this.dayPlannerModel.reset(this.entityItemCopies(), this.noteItemCopies());
  };

  this.updateTripPlan = function(tripPlanData) {
    $.extend(this.tripPlanData, tripPlanData);
  };

  this.updateLastModified = function(lastModified) {
    if (lastModified) {
      this.tripPlanData['last_modified'] = lastModified;
    }
  };

  this.dayPlannerModel = new DayPlannerModel(this.entityItemCopies(), this.noteItemCopies());
}

function TaxonomyTree(categories, subCategories) {
  var me = this;
  this.categories = categories;
  this.subCategoriesByCategoryId = {};
  $.each(categories, function(i, category) {
    me.subCategoriesByCategoryId[category['category_id']] = [];
  });
  $.each(subCategories, function(i, subCategory) {
    if (subCategory['category_id']) {
      me.subCategoriesByCategoryId[subCategory['category_id']].push(subCategory);
    } else {
      $.each(me.subCategoriesByCategoryId, function(categoryId, values) {
        values.unshift(subCategory);
      });
    }
  });

  this.allCategories = function() {
    return this.categories;
  };

  this.getSubCategoriesForCategory = function(categoryId) {
    return this.subCategoriesByCategoryId[categoryId];
  };
}

function ItemGroupCtrl($scope) {
  $scope.show = true;

  $scope.toggleSection = function() {
    $scope.show = !$scope.show;
    $scope.$broadcast('togglemarkers', $scope.show);
  };
}

function EntityCtrl($scope, $entityService, $modal, $dataRefreshManager,
    $pagePositionManager, $tripPlanModel, $pageStateModel, $timeout,
    $map, $mapBounds, $templateToStringRenderer) {
  var me = this;
  $scope.ed = $scope.item.data;
  var entityModel = new EntityModel($scope.item.data);
  $scope.editing = false;
  $scope.detailsExpanded = false;
  $scope.selectedDay = null;
  if ($scope.item.day()) {
    $scope.selectedDay = $tripPlanModel.dayPlannerModel.dayModelForDay($scope.item.day());
  }

  $scope.getDaySelectOptions = function() {
    var daySelectOptions = $tripPlanModel.dayPlannerModel.dayModels.slice(0);
    daySelectOptions.push({createNew: true});
    return daySelectOptions;
  };

  $scope.toggleDetails = function($event) {
    $scope.detailsExpanded = !$scope.detailsExpanded;
    $event.stopPropagation();
    $event.preventDefault();
  };

  $scope.openEditEntity = function() {
    $scope.editing = true;
  }

  $scope.cancelEditing = function() {
    $scope.editing = false;
  };

  $scope.hasDescription = function() {
    return !$scope.ed['description'] || isWhitespace($scope.ed['description']);
  };

  $scope.openEditPlaceModal = function() {
    var scope = $scope.$new(true);
    scope.isEditOfExistingEntity = true;
    var entityData = angular.copy($scope.item.data);
    scope.entityModel = new EntityModel(entityData);
    scope.ed = scope.entityModel.data;
    $modal.open({
      templateUrl: 'add-place-confirmation-template',
      scope: scope
    });    
  };

  // Note that this does not refresh the page state, so is only
  // appropriate for things like description editing which don't
  // require further updating.
  $scope.saveEntityEdit = function() {
    $entityService.editEntity($scope.item.data, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
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
    scope.entityModel = new EntityModel(angular.copy($scope.item.data));
    scope.ed = scope.entityModel.data;
    scope.ed['entity_id'] = null;
    $modal.open({
      templateUrl: 'reclip-confirmation-template',
      scope: scope
    });
  };

  $scope.deleteEntity = function() {
    $entityService.deleteEntity($scope.item.data, $tripPlanModel.tripPlanId())
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

  $scope.openModalCarousel = function(imgUrls) {
    var scope = $scope.$new(true);
    scope.slides = _.map(imgUrls, function(url) {
      return {imgUrl: url};
    });
    $modal.open({
      templateUrl: 'modal-carousel-template',
      windowClass: 'modal-carousel',
      scope: scope
    });
  };

  $scope.organizeIntoDay = function() {
    var dayPlannerModel = $scope.planModel.dayPlannerModel;
    var item = dayPlannerModel.findItemByEntityId($scope.ed['entity_id']);
    var dayModel = $scope.selectedDay = $scope.selectedDay.createNew ? dayPlannerModel.addNewDay() : $scope.selectedDay;
    var affectedItems = dayPlannerModel.organizeItem(
      item, dayModel.dayNumber, dayModel.getItems().length);
    var modifiedEntities = _.map(affectedItems, function(item) {
      return {
        'entity_id': item.data['entity_id'],
        'day': item.day(),
        'day_position': item.position()
      }
    });
    $dataRefreshManager.freeze();
    $entityService.editEntities(modifiedEntities, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.updateEntities(response['entities']);
          // This is kind of hacky.  Need to make it so that updateEntities()
          // somehow updates the data in this scope.
          $scope.ed['day'] = dayModel.dayNumber;
          if ($pageStateModel.isGroupByDay()) {
            $dataRefreshManager.redrawGroupings(function() {
              $timeout(function() {
                $pagePositionManager.scrollToEntity($scope.ed['entity_id']);
              });
            });
          }
        }
        $dataRefreshManager.unfreeze();
        // HACK: Trigger a click here so that the dropdown menu contain
        // the day-select pill will close.  The click event had previously
        // been suppressed to prevent the dropdown from closing when
        // clicking on the pill.
        $(document.body).trigger('click');
      }).error(function() {
        $dataRefreshManager.unfreeze();
      });
  };

  $scope.saveStarState = function(starred) {
    $scope.ed['starred'] = starred;
    $entityService.editEntity({
      'entity_id': $scope.ed['entity_id'],
      'starred': starred
    }, $tripPlanModel.tripPlanId())
    .success(function(response) {
      $tripPlanModel.updateLastModified(response['last_modified']);
    });
  };

  // Map and Marker Controls

  var toolsOverlay = null;

  this.initializeMarker = function() {
    var marker = entityModel.marker;
    if (!marker) {
      return;
    }
    marker.setMap($map);
    $mapBounds.extend(marker.getPosition())
    google.maps.event.addListener(marker, 'click', function() {
      $pageStateModel.selectedEntity = entityModel.data;
      $pagePositionManager.scrollToEntity(entityModel.entityId());
      $scope.$emit('asktocloseallinfowindows');
      me.createInfowindow(entityModel, marker, true);
      toolsOverlay = new MapMarkerToolsOverlay(marker.getMap(), marker.getPosition(),
        $templateToStringRenderer.render('map-marker-tools-template', $scope, true));
    });
  };

  this.initializeMarker();
  // TODO: Move this after all have initialized.
  if (!$mapBounds.isEmpty() && $pageStateModel.inMapView()
    && $tripPlanModel.numEntities() > 1) {
    $map.fitBounds($mapBounds);
  }

  $scope.openInfowindow = function() {
    if (!$pageStateModel.inMapView()) {
      return;
    }
    $scope.$emit('asktocloseallinfowindows');
    if (entityModel.marker) {
      me.createInfowindow(entityModel, entityModel.marker);
    }
  };

  this.createInfowindow = function(entityModel, marker, opt_nonAngularOrigin) {
    var scope = $scope.$new(true);
    scope.entity = entityModel;
    var infowindowContent = $templateToStringRenderer.render(
      'infowindow-template', scope, opt_nonAngularOrigin);
    entityModel.makeInfowindow(infowindowContent[0]).open($map, marker);
  };

  $scope.$on('closeallinfowindows', function() {
    if (entityModel.infowindow) {
      entityModel.infowindow.close();
    }
    toolsOverlay && toolsOverlay.setMap(null);
  });

  $scope.$on('clearallmarkers', function() {
    entityModel.clearMarker();
  });

  $scope.$on('togglemarkers', function(event, show) {
    if (entityModel.marker) {
      entityModel.marker.setMap(show ? $map : null);
      toolsOverlay && toolsOverlay.setMap(null);
    }
  });
}

function GuideviewEntityCtrl($scope) {
  $scope.ed = $scope.item.data;
}

function NoteCtrl($scope, $noteService, $tripPlanModel) {
  $scope.nd = $scope.item.data;
  $scope.editing = false;

  $scope.openEditNote = function() {
    $scope.editing = true;
  };

  $scope.saveNote = function() {
    $noteService.editNote($scope.item.data, $tripPlanModel.tripPlanId())
      .success(function(response) {
        $tripPlanModel.updateLastModified(response['last_modified']);
      });
    $scope.editing = false;
  };
}

function MarkerToolsCtrl($scope) {
  $scope.suppressEvent = function($event) {
    $event.stopPropagation();
    $event.preventDefault();
  };
}

MapMarkerToolsOverlay.prototype = new google.maps.OverlayView();

function MapMarkerToolsOverlay(map, position, contentDiv) {
  this.position = position;
  this.div = contentDiv;
  this.setMap(map);
}

MapMarkerToolsOverlay.prototype.onAdd = function() {
  this.getPanes().floatPane.appendChild(this.div[0]);
};

MapMarkerToolsOverlay.prototype.draw = function() {
  var overlayProjection = this.getProjection();
  var point = overlayProjection.fromLatLngToDivPixel(this.position);
  this.div.css({'position': 'absolute', 'left': point.x, 'top': point.y});
};

MapMarkerToolsOverlay.prototype.onRemove = function() {
  this.div.remove();
};

function GuideviewItemGroupCtrl($scope) {
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
  $scope.newTripPlanRawLocation = ''
  $scope.showCreateTripPlanForm = false;
  $scope.$watch('selectedTripPlan', function(newValue) {
    if (newValue.createNew) {
      $scope.showCreateTripPlanForm = true;
    } else {
      $scope.showCreateTripPlanForm = false;
    }
  });

  $scope.saveNewTripPlan = function(tripPlanDetails) {
    var newTripPlan = {'name': $scope.newTripPlanName};
    $tripPlanService.saveNewTripPlan(tripPlanDetails)
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
    var entityToSave = angular.copy($scope.entityModel.data);
    delete entityToSave['day'];
    delete entityToSave['day_position'];
    $entityService.saveNewEntity(entityToSave, tripPlanId)
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

function TemplateToStringRenderer($templateCache, $compile) {

  // nonAngularOrigin means that this template is being rendered in response
  // to an event that originated outside of Angular, for example a click
  // on a Google Maps marker which is handled by the Maps event system.
  // In this case, since we're using Angular templates, we must manually
  // $apply the scope of the template to complete rendering.  We cannot
  // do this in all cases though because if the event originated within
  // Angular than we are already in the midst of a $digest cycle.
  this.render = function(templateName, scope, nonAngularOrigin) {
    var template = $templateCache.get(templateName);
    if (!template) {
      throw 'No template with name ' + templateName;
    }
    var node = $compile(template)(scope);
    if (nonAngularOrigin) {
      scope.$apply();
    }
    return node;
  };
}

var Grouping = {
  CATEGORY: 1,
  DAY: 2
};

var View = {
  MAP_VIEW: 1,
  GUIDE_VIEW: 2,
  SOURCE_VIEW: 3,
  OFFSITE_VIEW: 4
};

var SidePanelMode = {
  ENTITIES: 1,
  ADD_PLACE: 2
};

function PageStateModel(view, grouping) {
  this.view = view;
  this.sidePanelMode = SidePanelMode.ENTITIES;
  this.grouping = grouping;
  this.selectedEntity = null;
  this.offsiteUrl = null;

  this.inMapView = function() {
    return this.view == View.MAP_VIEW;
  };

  this.inGuideView = function() {
    return this.view == View.GUIDE_VIEW;
  };

  this.inSourceView = function() {
    return this.view == View.SOURCE_VIEW;
  };

  this.inOffsiteView = function() {
    return this.view == View.OFFSITE_VIEW;
  };

  this.showMapView = function() {
    this.view = View.MAP_VIEW;
  };

  this.showGuideView = function() {
    this.view = View.GUIDE_VIEW;
  };

  this.showSourceView = function() {
    this.view = View.SOURCE_VIEW;
  };

  this.showOffsiteView = function() {
    this.view = View.OFFSITE_VIEW;
  };

  this.inEntityPanel = function() {
    return this.sidePanelMode == SidePanelMode.ENTITIES;
  };

  this.inAddPlacePanel = function() {
    return this.sidePanelMode == SidePanelMode.ADD_PLACE;
  };

  this.showEntityPanel = function() {
    this.sidePanelMode = SidePanelMode.ENTITIES;
  };

  this.showAddPlacePanel = function() {
    this.sidePanelMode = SidePanelMode.ADD_PLACE;
  };

  this.isGroupByCategory = function() {
    return this.grouping == Grouping.CATEGORY;
  };

  this.isGroupByDay = function() {
    return this.grouping == Grouping.DAY;
  };

  this.groupByCategory = function() {
    this.grouping = Grouping.CATEGORY;
  };

  this.groupByDay = function() {
    this.grouping = Grouping.DAY;
  };

  this.entityIsSelected = function(entityId) {
    return this.selectedEntity && this.selectedEntity['entity_id'] == entityId;
  };
}

PageStateModel.fromInitialState = function(initialState) {
  var view = initialState['view'] == 'guide' ? View.GUIDE_VIEW : View.MAP_VIEW;
  var grouping = initialState['sort'] == 'day' ? Grouping.DAY : Grouping.CATEGORY;
  return new PageStateModel(view, grouping);
}

function ItemGroupModel(grouping, groupKey, groupRank, itemRankFn) {
  this.grouping = grouping;
  this.groupKey = groupKey;
  this.groupRank = groupRank;
  this.sortedItems = [];

  this.addItem = function(item) {
    var insertionIndex = itemRankFn ? _.sortedIndex(this.sortedItems, item, itemRankFn)
      : this.sortedItems.length;
    this.sortedItems.splice(insertionIndex, 0, item);
  };

  this.getItems = function() {
    return this.sortedItems;
  };

  this.hasContent = function() {
    return this.sortedItems && this.sortedItems.length
      && (this.getEntityItems().length || this.getNonemptyNoteItems().length);
  };

  this.getEntityItems = function() {
    return _.filter(this.sortedItems, function(item) {
      return item.isEntity();
    });
  };

  this.getNoteItems = function() {
    return _.filter(this.sortedItems, function(item) {
      return item.isNote();
    });
  };

  this.getNonemptyNoteItems = function() {
    return _.filter(this.getNoteItems(), function(noteItem) {
      return !!noteItem.data['text'];
    });
  };

  this.isDayGrouping = function() {
    return this.grouping == Grouping.DAY;
  };

  this.isCategoryGrouping = function() {
    return this.grouping == Grouping.CATEGORY;
  };
}

function createDayItemGroupModel(dayNumber) {
  return new ItemGroupModel(Grouping.DAY, dayNumber, dayNumber, function(item) {
    return item.position();
  });
}

var CATEGORY_NAME_TO_SORTING_RANK = {
  'lodging': 1,
  'food_and_drink': 2,
  'attractions': 3,
  'entertainment': 4,
  'activities': 5,
  'shopping': 6
};

function createCategoryItemGroupModel(categoryName) {
  var groupRank = CATEGORY_NAME_TO_SORTING_RANK[categoryName];
  return new ItemGroupModel(Grouping.CATEGORY, categoryName, groupRank, null);
}

function processIntoGroups(grouping, items) {
  var groupsByKey = {};
  var groupKeyFn = null;
  var groupCreateFn = null
  if (grouping == Grouping.CATEGORY) {
    groupKeyFn = function(item) {
      return item.data['category'] && item.data['category']['name'];
    };
    groupCreateFn = createCategoryItemGroupModel;
  } else if (grouping == Grouping.DAY) {
    groupKeyFn = function(item) {
      return item.day();
    };
    groupCreateFn = createDayItemGroupModel;
  }

  $.each(items, function(i, item) {
    var groupKey = groupKeyFn(item);
    var groupModel = groupsByKey[groupKey];
    if (!groupModel) {
      groupModel = groupsByKey[groupKey] = groupCreateFn(groupKey);
    }
    groupModel.addItem(item);
  });
  return _.sortBy(_.values(groupsByKey), 'groupRank');
}

function RootCtrl($scope, $http, $timeout, $modal, $tripPlanService, $tripPlanModel, $tripPlan, 
    $map, $mapBounds, $pageStateModel, $entityService, $allowEditing, $sce) {
  var me = this;
  $scope.pageStateModel = $pageStateModel;
  $scope.planModel = $tripPlanModel;
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
  this.processItemsIntoGroups = function() {
    $scope.$broadcast('clearallmarkers');
    $scope.itemGroups = processIntoGroups($scope.pageStateModel.grouping, $scope.planModel.allItems());
  };
  this.processItemsIntoGroups();

  $scope.scrollState = {
    entityId: null
  };

  $scope.$on('scrolltoentity', function($event, entityId) {
    $scope.scrollState.entityId = entityId;
  });

  $scope.$on('redrawgroupings', function($event, opt_callback) {
    me.processItemsIntoGroups();
    opt_callback && opt_callback();
  });

  $scope.trustSource = function(src) {
    return $sce.trustAsResourceUrl(src);
  };

  $scope.toggleOmnibox = function() {
    $scope.omniboxState.visible = !$scope.omniboxState.visible;
  };

  this.mapViewInitialized = $pageStateModel.inMapView();
  $scope.showMapView = function() {
    if (!$scope.pageStateModel.inMapView()) {
      $scope.pageStateModel.showMapView();
      $timeout(function() {
        var oldCenter = $map.getCenter();
        google.maps.event.trigger($map, 'resize');
        $map.setCenter(oldCenter);
        console.log(me.mapViewInitialized);
        if (!me.mapViewInitialized) {
          $map.fitBounds($mapBounds);
        }
        me.mapViewInitialized = true;
      });
    }
  };

  google.maps.event.addListener($map, 'click', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  $scope.groupByCategory = function() {
    if (!$scope.pageStateModel.isGroupByCategory()) {
      $scope.pageStateModel.groupByCategory();
      me.processItemsIntoGroups();
    }
  };

  $scope.groupByDay = function() {
    if (!$scope.pageStateModel.isGroupByDay()) {
      $scope.pageStateModel.groupByDay();
      me.processItemsIntoGroups();
    }
  };

  $scope.showGuideView = function() {
    $scope.pageStateModel.showGuideView();
  };

  $scope.showSourceView = function() {
    $scope.alreadyLoadedSourceView = true;
    $scope.pageStateModel.showSourceView();
  };

  $scope.showEntityPanel = function() {
    $scope.pageStateModel.showEntityPanel();
    if ($scope.pageStateModel.inOffsiteView()) {
      $scope.showMapView();
    }
  };

  $scope.showAddPlacePanel = function() {
    $scope.pageStateModel.showAddPlacePanel();
  };

  $scope.loadOffsiteUrl = function(url) {
    $scope.pageStateModel.offsiteUrl = url;
    $scope.pageStateModel.showOffsiteView();
  };

  $scope.coverImageClicked = function() {
    if ($tripPlanModel.hasOverview()) {
      $scope.showGuideView();
      $scope.pageStateModel.selectedEntity = null;
    }
  };

  $scope.selectEntity = function(entityData) {
    $scope.pageStateModel.selectedEntity = entityData;
  };

  $scope.toggleAccountDropdown = function() {
    $scope.accountDropdownOpen = !$scope.accountDropdownOpen;
  };

  $scope.editTripPlanSettings = function() {
    $scope.editingTripPlanSettings = true;
  };

  $scope.cancelEditTripPlanSettings = function() {
    $scope.editingTripPlanSettings = false;
    $scope.editableTripPlanSettings.name = $tripPlan['name'];
  };

  $scope.onTripPlanNameKeyup = function($event) {
    if ($event.which == 27) {
      $scope.cancelEditTripPlanSettings();
    }
  };

  $scope.saveTripPlanSettings = function() {
    // Prevent double-submits
    if (me.alreadySaving) {
      return;
    }
    me.alreadySaving = true;
    if ($scope.editableTripPlanSettings.name == $tripPlan['name']) {
      $scope.editingTripPlanSettings = false;
      me.alreadySaving = false;
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
        $tripPlanModel.tripPlanData['name'] = newName;
        $tripPlanModel.updateLastModified(response['trip_plans'][0]['last_modified']);
        // TODO: This might be redundant now.
        $tripPlan['name'] = newName;
        me.alreadySaving = false;
      })
      .error(function() {
        alert('Failed to save edits');
        me.alreadySaving = false;
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

  $scope.startGmapsImport = function() {
    $modal.open({
      templateUrl: 'gmaps-importer-template',
      scope: $scope.$new(true)
    });
  };

  $scope.openDayPlanner = function(windowClass) {
    $modal.open({
      templateUrl: 'day-planner-template',
      scope: $scope,
      backdrop: 'static',
      windowClass: windowClass
    });
  };

  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  var startTripPlanModal = null;

  this.selectTripLocation = function(tripPlanDetails) {
    tripPlanDetails['trip_plan_id'] = $tripPlanModel.tripPlanId();
    $tripPlanService.editTripPlan(tripPlanDetails)
      .success(function(response) {
        $map.setCenter(gmapsLatLngFromJson(tripPlanDetails['location_latlng']));
        if (tripPlanDetails['location_bounds']) {
          $map.fitBounds(gmapsBoundsFromJson(tripPlanDetails['location_bounds']));
        }
        $tripPlanModel.updateTripPlan(response['trip_plans'][0]);
        document.title = response['trip_plans'][0]['name'];
        startTripPlanModal && startTripPlanModal.close();
      });
  };

  if ($allowEditing && !$tripPlanModel.hasLocation() && $tripPlanModel.isEmpty()) {
    startTripPlanModal = $modal.open({
      templateUrl: 'start-new-trip-modal-template',
      scope: $.extend($scope.$new(true), {selectTripLocation: this.selectTripLocation}),
      backdrop: 'static',
      keyboard: false
    });
  }

  this.refresh = function(opt_force, opt_callback) {
    // TODO: Don't even register the refresh loop if editing is not allowed.
    if (!opt_force && ($scope.refreshState.paused || !$allowEditing)) {
      return;
    }
    var lastModified = opt_force ? null : $tripPlan['last_modified'];
    $entityService.getByTripPlanId($tripPlan['trip_plan_id'], lastModified)
      .success(function(response) {
        if ($scope.refreshState.paused) {
          return;
        }
        if ($tripPlan['last_modified'] == response['last_modified']
          || response['response_summary'] == 'NO_CHANGES_SINCE_LAST_MODIFIED') {
          return;
        }
        var planModel = $scope.planModel;
        var newEntities = response['entities'];
        $tripPlan['last_modified'] = response['last_modified'];
        $scope.$broadcast('clearallmarkers');
        // Angular's dirty-checking does not seem to pick up that the
        // model has changed if we just assign to the new model...
        // TODO: This is probably a non-issue now.  Dirty-checking should
        // work if you update a model in-place instead of replacing it.
        // So the timeout can probably be removed now.
        $scope.planModel = null;
        $timeout(function() {
          planModel.resetEntities(newEntities);
          $scope.planModel = planModel;
          me.processItemsIntoGroups();
          opt_callback && opt_callback;
        });
      });
  };

  $scope.$on('refreshdata', function(event, opt_force, opt_callback) {
    me.refresh(opt_force, opt_callback);
  });
  $scope.$on('freezerefresh', function() {
    $scope.refreshState.paused = true;
  });
  $scope.$on('unfreezerefresh', function() {
    $scope.refreshState.paused = false;
  });

  var refreshInterval = 5000;
  function refreshPoll() {
    me.refresh();
    $timeout(refreshPoll, refreshInterval);
  }
  $timeout(refreshPoll, refreshInterval);
}

function gmapsLatLngFromJson(latlngJson) {
  return new google.maps.LatLng(latlngJson['lat'], latlngJson['lng']);
}

function gmapsBoundsFromJson(latlngBoundsJson) {
  return new google.maps.LatLngBounds(
    gmapsLatLngFromJson(latlngBoundsJson['southwest']),
    gmapsLatLngFromJson(latlngBoundsJson['northeast']))
}

function latlngFromGmaps(gmapsLatlng) {
  return gmapsLatlng && {
    'lat': gmapsLatlng.lat(),
    'lng': gmapsLatlng.lng()
  };
}

function boundsJsonFromGmapsBounds(gmapsBounds) {
  return gmapsBounds && {
    'southwest': {
      'lat': gmapsBounds.getSouthWest().lat(),
      'lng': gmapsBounds.getSouthWest().lng()
    },
    'northeast': {
      'lat': gmapsBounds.getNorthEast().lat(),
      'lng': gmapsBounds.getNorthEast().lng()
    }
  };
}

function createMap(tripPlanData) {
  var center = new google.maps.LatLng(0, 0);
  if (tripPlanData['location_latlng']) {
    center = gmapsLatLngFromJson(tripPlanData['location_latlng']);
  }
  var mapOptions = {
    center: center,
    zoom: 2,
    panControl: false,
    scaleControl: true,
    streetViewControl: false,
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    },
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP
    }
  };
  var map = new google.maps.Map($('#map')[0], mapOptions);
  if (tripPlanData['location_bounds']) {
    map.fitBounds(gmapsBoundsFromJson(tripPlanData['location_bounds']));
  }
  return map;
}

function StartNewTripInputCtrl($scope, $timeout, $tripPlanService) {
  var me = this;
  $scope.ready = false;
  $scope.locationText = '';
  $scope.searchResults = null;
  $scope.searching = false;
  // Very strange, something is stealing the focus from the
  // input when setting the ready state either immediately or after
  // a 0-second timeout.
  $timeout(function() {
    $scope.ready = true;
  }, 500);

  $scope.placeChanged = function(place) {
    if (!place) {
      return;
    }
    if (!place['geometry']) {
      return me.searchForPlace(place['name']);
    }
    $scope.selectResult(place);
  };

  this.searchForPlace = function(query) {
    $scope.searchResults = null;
    $scope.searching = true;
    var request = {
      query: query
    };
    var dummyMap = new google.maps.Map($('<div>')[0], {
      center: new google.maps.LatLng(0, 0)
    });
    var searchService = new google.maps.places.PlacesService(dummyMap);
    searchService.textSearch(request, function(results, status) {
      $scope.$apply(function() {
        $scope.searching = false;
        if (status != google.maps.places.PlacesServiceStatus.OK) {
          alert('Search failed, please try again.');
          return;
        }
        $scope.searchResults = results;
      });
    });
  };

  $scope.selectResult = function(place) {
    var tripPlanDetails = me.placeToTripPlanDetails(place);
    $scope.onSelectPlace({$tripPlanDetails: tripPlanDetails});
  };

  this.placeToTripPlanDetails = function(place) {
    var geometry = place['geometry'];
    var location = geometry && geometry['location'];
    var viewport = geometry && geometry['viewport'];
    var tripPlanDetails = {
      'name': place['name'],
      'location_name': place['formatted_address']
    };
    if (location) {
      tripPlanDetails['location_latlng'] = {
        'lat': location.lat(),
        'lng': location.lng()
      };
    }
    if (viewport) {
      tripPlanDetails['location_bounds'] = {
        'southwest': {
          'lat': viewport.getSouthWest().lat(),
          'lng': viewport.getSouthWest().lng()
        },
        'northeast': {
          'lat': viewport.getNorthEast().lat(),
          'lng': viewport.getNorthEast().lng()
        }
      }
    }
    return tripPlanDetails;
  };
}

function AccountDropdownCtrl($scope, $accountService, $tripPlanService, $accountInfo, $tripPlan, $allTripPlans) {
  $scope.accountInfo = $accountInfo;
  $scope.accountInfo.loggedIn = !!$accountInfo['email'];
  $scope.showLoginForm = !$scope.accountInfo.loggedIn;
  $scope.currentTripPlan = $tripPlan;
  $scope.allTripPlans = $allTripPlans;

  $scope.doLogin = function() {
    if (!$scope.accountInfo['email']) {
      return;
    }
    $accountService.loginAndMigrate($scope.accountInfo['email'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          location.href = location.href;
        } else {
          var error = extractError(response, AccountServiceError.INVALID_EMAIL);
          if (error) {
            alert(error['message']);
          } else {
            alert('Login failed');
          }
        }
      }).error(function() {
        alert('Login failed');
      });
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

var SUB_CATEGORY_NAME_TO_ICON_URL = {
  'outdoor': 'outdoor.png',
  'dance': 'dance.png',
  'food_truck': 'food-truck.png',
  'coffee_shop': 'coffee.png',
  'hostel': 'hostel.png',
  'bakery': 'bakery.png',
  'dessert': 'dessert.png',
  'sports': 'sports.png',
  'music': 'music.png',
  'comedy': 'comedy.png',
  'friends_and_family': 'friends-and-family.png',
  'hotel': 'hotel.png',
  'private_rental': 'private-rental.png',
  'bed_and_breakfast': 'bed-and-breakfast.png',
  'theater': 'theater.png',
  'bar': 'bar.png',
  'restaurant': 'restaurant.png',
  'couchsurfing': 'couch-surfing.png',
  'street_food': 'street-food.png',
  'nightclub': 'nightclub.png',
  'tour': 'tour.png',
  'landmark': 'landmark.png',
  'musuem': 'museum.png'
};

var CATEGORY_NAME_TO_ICON_URL = {
  'activities': 'activity.png',
  'shopping': 'shopping.png',
  'entertainment': 'entertainment.png',
  'attractions': 'sight.png',
  'lodging': 'lodging.png',
  'food_and_drink': 'food-and-drink.png'
};

var DEFAULT_ICON_URL = 'default.png';

function categoryToIconUrl(categoryName, subCategoryName, precision) {
  var iconUrl = '';
  if (subCategoryName) {
    iconUrl = SUB_CATEGORY_NAME_TO_ICON_URL[subCategoryName];
  }
  if (!iconUrl && categoryName) {
    iconUrl = CATEGORY_NAME_TO_ICON_URL[categoryName];
  }
  iconUrl = iconUrl || DEFAULT_ICON_URL
  if (precision == 'Imprecise') {
    iconUrl = iconUrl.replace('.', '-imprecise.');
  }
  return iconUrl;
}

function DataRefreshManager($rootScope) {
  this.askToRefresh = function() {
    $rootScope.$broadcast('refreshdata');
  };

  this.forceRefresh = function(opt_callback) {
    $rootScope.$broadcast('refreshdata', true, opt_callback);
  };

  this.redrawGroupings = function(opt_callback) {
    $rootScope.$broadcast('redrawgroupings', opt_callback);
  };

  this.freeze = function() {
    $rootScope.$broadcast('freezerefresh');
  };

  this.unfreeze = function() {
    $rootScope.$broadcast('unfreezerefresh');
  };
}

function PagePositionManager($rootScope) {
  this.scrollToEntity = function(entityId) {
    $rootScope.$broadcast('scrolltoentity', entityId);
  };
}


function AddPlacePanelCtrl($scope, $timeout, $tripPlanModel, $sampleSites,
    $entityService, $dataRefreshManager) {
  var me = this;
  $scope.sampleSites = $sampleSites;
  $scope.selectedSite = $sampleSites[0];
  $scope.query = null;
  $scope.loadingData = false;
  $scope.searchResults = null;
  $scope.searchComplete = false;
  $scope.resultsAreFromSearch = true;

  $scope.googlePlaceSelected = function(place) {
    $scope.loadingData = true;
    if (place['reference']) {
      $entityService.googleplacetoentity(place['reference'])
        .success(me.processResponse);
    } else {
      $entityService.googletextsearchtoentities(place['name'],
        $tripPlanModel.tripPlanData['location_latlng'])
        .success(me.processResponse);
    }
  };

  $scope.textPasted = function() {
    // Ugly hack to wrap this in a timeout; without it, the paste event
    // fires before the input has been populated with the pasted data.
    $timeout(function() {
      if (!$scope.query || !looksLikeUrl($scope.query)) {
        return;
      }
      $scope.loadingData = true;
      $scope.resultsAreFromSearch = false;
      $entityService.urltoentities($scope.query)
        .success(me.processResponse);
    });
  };

  this.processResponse = function(response) {
    if (response['entity']) {
      $scope.searchResults = [response['entity']]
    } else {
      $scope.searchResults = response['entities'] || [];
    }
    if ($scope.searchResults.length == 1) {
      $scope.searchResults[0].selected = true;
    }
    $scope.loadingData = false;
    $scope.searchComplete = true;
  };

  $scope.selectedResults = function() {
    return _.filter($scope.searchResults, function(entityData) {
      return entityData.selected;
    });
  };

  $scope.saveButtonEnabled = function() {
    var selectedResults = $scope.selectedResults();
    return selectedResults && selectedResults.length;
  };

  $scope.saveResults = function() {
    $entityService.saveNewEntities($scope.selectedResults(), $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $dataRefreshManager.askToRefresh();
          $scope.showEntityPanel();
        }
      }).error(function() {
        alert('Failed to save places');
      });
  };

  $scope.selectSearchMode = function(siteInfo) {
    $scope.selectedSite = siteInfo;
  };

  $scope.loadSite = function(site) {
    $scope.selectedSite = site;
    var context = {
      'location': encodeURIComponent($tripPlanModel.tripPlanData['location_name']),
      'lat': $tripPlanModel.tripPlanData['location_latlng']['lat'],
      'lng': $tripPlanModel.tripPlanData['location_latlng']['lng']
    };
    var offsiteUrl = sprintf(site['search_url_template'], context);
    $scope.loadOffsiteUrl(offsiteUrl);
  };
}

//
// Shared entity result handling 
//

var EntityResultState = {
  NOT_EDITING: 1,
  EDITING_NOTE: 2,
  EDITING_PHOTOS: 3,
  EDITING_LOCATION: 4
};

function EntityResultCtrl($scope, $window) {
  var me = this;
  $scope.ed = $scope.entityData;
  $scope.em = new EntityModel($scope.entityData);
  $scope.im = new ItemModel($scope.entityData);

  $scope.EntityResultState = EntityResultState;
  $scope.state = $scope.ed['name'] ? EntityResultState.NOT_EDITING
    : EntityResultState.EDITING_LOCATION;

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
    marker.setMap($map);
  };

  $scope.editing = function() {
    return $scope.state != EntityResultState.NOT_EDITING;
  };

  $scope.closeEditor = function() {
    $scope.state = EntityResultState.NOT_EDITING;
    $scope.displayState.dirtyCounter++;
    if ($scope.inIframe) {
      $window.parent.postMessage('tc-photo-editing-inactive', '*');    
    }
  };

  $scope.openEditNote = function() {
    $scope.state = EntityResultState.EDITING_NOTE;
    $scope.displayState.dirtyCounter++;
  };

  $scope.openEditLocation = function() {
    $scope.state = EntityResultState.EDITING_LOCATION;
    $scope.displayState.dirtyCounter++;
  };

  $scope.openEditPhotos = function() {
    $scope.state = EntityResultState.EDITING_PHOTOS;
    $scope.displayState.dirtyCounter++;
    if ($scope.inIframe) {
      $window.parent.postMessage('tc-photo-editing-active', '*'); 
    }
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

function tcEntityResult() {
  return {
    restrict: 'AE',
    scope: {
      showCheckboxes: '=',
      entityData: '=',
      activeTripPlan: '=',
      clickToSelect: '=',
      editable: '=',
      inIframe: '=',
      displayState: '='
    },
    controller: EntityResultCtrl,
    templateUrl: 'one-entity-result-template'
  };
}

function EntityResultPhotoCtrl($scope, $window) {
  if (_.isEmpty($scope.ed['photo_urls'])) {
    $scope.ed['photo_urls'] = [];
  }
  var urls = $scope.ed['photo_urls'];
  var selectedImgIndex = urls.length ? 0 : null;

  if ($scope.inIframe) {
    $($window).on('message', function(event) {
      $scope.$apply(function() {
        if ($scope.state != EntityResultState.EDITING_PHOTOS) {
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
  }

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

angular.module('entityResultModule', [])
  .controller('EntityResultPhotoCtrl'['$scope', '$window', EntityResultPhotoCtrl])
  .directive('tcEntityResult', tcEntityResult);

//
// End shared entity result handling
//


function AddPlaceConfirmationCtrl($scope, $timeout, $entityService,
    $dataRefreshManager, $tripPlan, $taxonomy) {
  var me = this;
  $scope.editingFields = $scope.isEditOfExistingEntity;

  $scope.categories = $taxonomy.allCategories();
  $scope.getSubCategories = function(categoryId) {
    return $taxonomy.getSubCategoriesForCategory(categoryId);
  };

  this.makeMarker = function(entityData, map, draggable) {
    var latlngJson = entityData['latlng'] || {};
    var latlng = new google.maps.LatLng(
      latlngJson['lat'] || 0.0, latlngJson['lng'] || 0.0);
    return new google.maps.Marker({
      draggable: draggable,
      position: latlng,
      icon: '/static/img/map-icons/' + entityData['icon_url'],
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
    $scope.ed['sub_category'] = $taxonomy.getSubCategoriesForCategory(
      $scope.ed['category']['category_id'])[0];
    $scope.updateMarkerIcon();
  };

  $scope.updateMarkerIcon = function() {
    var data =  $scope.entityModel.data;
    var iconUrl = categoryToIconUrl(
      data['category'] && data['category']['name'],
      data['sub_category'] && data['sub_category']['name'],
      data['address_precision']);
    $scope.entityModel.data['icon_url'] = iconUrl;
    editableMarker.setIcon('/static/img/map-icons/' + iconUrl)
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


function ItemModel(data) {
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

  this.isPreciseLocation = function() {
    return this.data['address_precision'] == 'Precise';
  };

  this.hasLocation = function() {
    return !!this.data['latlng'];
  };

  this.hasCategory = function() {
    return !_.isEmpty(this.data['category'])
      && this.data['category']['category_id'] != 0;
  }

  this.hasSubCategory = function() {
    return !_.isEmpty(this.data['sub_category'])
      && this.data['sub_category']['sub_category_id'] != 0;
  };

  this.categoryDisplayText = function() {
    if (this.data['sub_category']) {
      return this.data['sub_category']['display_name'];
    }
    return this.data['category']['display_name'];
  };

  this.hasPhotos = function() {
    return this.data['photo_urls'] && this.data['photo_urls'].length;
  };

  this.latlngString = function() {
    return [this.data['latlng']['lat'], this.data['latlng']['lng']].join(',')
  };

  this.staticMiniMapUrl = function(opt_referenceLatlng) {
    var parts = ['//maps.googleapis.com/maps/api/staticmap?sensor=false&size=180x120',
      '&key=AIzaSyDcdswqGzFBfaTBWyQx-7avmEtdwLvfooQ',
      '&center=', this.latlngString(),
      '&markers=color:red%7C', this.latlngString()];
    if (opt_referenceLatlng) {
      var referenceLatlngString = [opt_referenceLatlng['lat'],
        opt_referenceLatlng['lng']].join(',');
      parts.push('&markers=size:small%7Ccolor:blue%7C' + referenceLatlngString);
    }
    return parts.join('');
  };

  this.getBackgroundImageUrl = function(opt_referenceLatlng) {
    if (this.hasPhotos()) {
      return this.data['photo_urls'][0];
    } else if (this.hasLocation()) {
      return this.staticMiniMapUrl(opt_referenceLatlng);
    } else {
      return '';
    }
  };
}

function DayPlannerDayModel(dayNumber) {
  this.dayNumber = dayNumber;
  this.items = [];
  this.noteItem = new ItemModel({
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
    return this.items.slice(position);
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
    if (item.day() != this.dayNumber) {
      throw 'Asked to remove an item tagged as day ' + item.day()
        + ' from day ' + this.dayNumber;
    }
    var oldPosition = item.position();
    this.items.splice(oldPosition, 1);
    this.recalculatePositions();
    return this.items.slice(oldPosition);
  };

  this.reorderItem = function(item, newPosition) {
    var oldPosition = item.position();
    this.items.splice(oldPosition, 1);
    this.addItem(item, newPosition);
    return this.items.slice(Math.min(oldPosition, newPosition));
  };

  this.getItems = function() {
    return this.items;
  };

  this.hasItems = function() {
    return !_.isEmpty(this.items);
  };

  this.setDay = function(newDayNumber) {
    this.dayNumber = newDayNumber;
    $.each(this.items, function(i, item) {
      item.setDay(newDayNumber);
    });
    this.noteItem.setDay(newDayNumber);
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

  this.resetEmpty = function() {
    this.items.length = 0;
    this.noteItem = new ItemModel({
      'day': this.dayNumber,
      'text': ''
    });
  };
}

function DayPlannerModel(entityItems, noteItems) {
  var me = this;
  this.dayModels = [];
  this.unorderedItems = [];
  this.noteItemsFromDeletedDays = [];

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

  this.reset = function(entityItems, noteItems) {
    $.each(this.dayModels, function(i, dayModel) {
      dayModel.resetEmpty();
    });
    this.unorderedItems.length = 0;
    this.noteItemsFromDeletedDays.length = 0;
    $.each(entityItems, function(i, item) {
      if (item.day()) {
        me.dayModelForDay(item.day()).addItem(item, item.position());
      } else {
        me.unorderedItems.push(item);
      }
    });
    $.each(noteItems, function(i, noteItem) {
      me.dayModelForDay(noteItem.day()).setNote(noteItem);
    });
    $.each(this.dayModels, function(i, dayModel) {
      if (!dayModel) {
        me.dayModelForDay(i + 1);
      }
    });
    if (_.isEmpty(this.dayModels)) {
      this.dayModelForDay(1);
    }
  };

  // Initialization
  this.reset(entityItems, noteItems);


  this.addNewDay = function() {
    return this.dayModelForDay(this.dayModels.length + 1);
  };

  this.organizeItem = function(item, dayNumber, position) {
    if (item.day() == dayNumber && item.position() == position) {
      return;
    }

    var affectedItems = [];

    if (item.day() && item.day() > 0) {
      if (item.day() == dayNumber) {
        var result = this.dayModelForDay(dayNumber).reorderItem(item, position);
        affectedItems.push.apply(affectedItems, result);
      } else {
        var result1 = this.dayModelForDay(item.day()).removeItem(item);
        var result2 = this.dayModelForDay(dayNumber).addItem(item, position);
        affectedItems.push.apply(affectedItems, result1);
        affectedItems.push.apply(affectedItems, result2);
      }
    } else {
      removeElemByValue(this.unorderedItems, item);
      var result = this.dayModelForDay(dayNumber).addItem(item, position);
      affectedItems.push.apply(affectedItems, result);
    }
    return affectedItems;
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

  this.deleteDay = function(dayModel) {
    var indexToRemove = dayModel.dayNumber - 1;
    this.clearDay(dayModel);
    this.dayModels.splice(indexToRemove, 1);
    $.each(this.dayModels.slice(indexToRemove), function(i, model) {
      model.setDay(model.dayNumber - 1);
    });
    if (dayModel.noteItem && dayModel.noteItem.data['note_id']) {
      this.noteItemsFromDeletedDays.push(dayModel.noteItem);
    }
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
    var noteItems = _.map(this.dayModels, function(dayModel) {
      return dayModel.noteItem;
    });
    return this.noteItemsFromDeletedDays.concat(noteItems);
  };

  this.findItemByEntityId = function(entityId) {
    for (var i = 0, I = this.unorderedItems.length; i < I; i++) {
      if (this.unorderedItems[i].data['entity_id'] == entityId) {
        return this.unorderedItems[i];
      }
    }
    for (var i = 0, I = this.dayModels.length; i < I; i++ ) {
      var dayModel = this.dayModels[i];
      for (var j = 0, J = dayModel.getItems().length; j < J; j++) {
        if (dayModel.getItems()[j].data['entity_id'] == entityId) {
          return dayModel.getItems()[j];
        }
      }
    }
    return null;
  };
}

function DayPlannerDropTargetCtrl($scope) {
  var me = this;
  $scope.dragover = false;
  $scope.innerDragover = false

  $scope.isDragActive = function() {
    return me.isValidDropTarget();
  };

  $scope.onDragenter = function($event) {
    if (me.isValidDropTarget()) {
      $scope.dragover = true;
      $event.preventDefault();
    }
  };

  $scope.onDragleave = function($event) {
    if (!$scope.innerDragover) {
      $scope.dragover = false;
    }
  };

  $scope.onInnerDragenter = function() {
    $scope.innerDragover = true;
  };

  $scope.onInnerDragleave = function() {
    $scope.innerDragover = false;
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
  $scope.dayDragover = false;

  $scope.openNoteEditor = function() {
    $scope.editingNote = true;
  };

  $scope.closeNoteEditor = function() {
    $scope.editingNote = false;
  };

  $scope.isValidDayForDrop = function() {
    return $scope.dragItem && $scope.dragItem.day() != $scope.dayModel.dayNumber;
  };

  $scope.onDayDragenter = function($event) {
    $scope.dayDragover = true;
  };

  $scope.onDayDragover = function($event) {
    $scope.dayDragover = true;
    if ($scope.isValidDayForDrop()) {
      $event.preventDefault();
    }
  };
}

function DayPlannerDraggableEntityCtrl($scope) {
  $scope.activeItemIsThis = function(itemModel) {
    return $scope.dragItem && $scope.dragItem === itemModel;
  };
}

function DayPlannerCtrl($scope, $entityService, $noteService, $tripPlanModel, $dataRefreshManager) {
  var me = this;
  var unorderedItems = [];
  var orderedItems = [];

  // TODO: Use a method on the TripPlanModel itself to get the day planner model.
  $scope.dayPlannerModel = new DayPlannerModel($tripPlanModel.entityItemCopies(), $tripPlanModel.noteItemCopies());
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
    $event.originalEvent.dataTransfer.setData('blah', 'dummy-data-for-ff');
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

  $scope.handleDayDrop = function($event, dayModel) {
    $event.preventDefault();
    $event.stopPropagation();
    $scope.handleDrop(dayModel.dayNumber, dayModel.items.length);
  };

  $scope.clearItem = function(item) {
    $scope.dayPlannerModel.clearItem(item);
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
    if (!operations.length) {
      return me.saveNotes(me.afterSaving);
    }
    var request = {'operations': operations};
    $entityService.mutate(request)
      .success(function(response) {
        var modifiedEntities = response['entities'];
        $tripPlanModel.updateEntities(modifiedEntities);
        $tripPlanModel.updateLastModified(response['last_modified']);
        me.saveNotes(me.afterSaving);
      });
  };

  this.saveNotes = function(opt_callback) {
    var allNotes = _.map($scope.dayPlannerModel.allNoteItems(), function(item) { return item.data; });
    var operations = [];
    var tripPlanId = $tripPlanModel.tripPlanId();
    $.each(allNotes, function(i, note) {
      if (note['note_id']) {
        if (!note['text'] || isWhitespace(note['text'])) {
          operations.push($noteService.operationFromNote(note, tripPlanId, Operator.DELETE));
        } else {
          operations.push($noteService.operationFromNote(note, tripPlanId, Operator.EDIT));
        }
      } else if (!note['note_id'] && note['text'] && !isWhitespace(note['text'])) {
        operations.push($noteService.operationFromNote(note, tripPlanId, Operator.ADD));
      }
    });
    if (!operations.length) {
      opt_callback && opt_callback();
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

  this.afterSaving = function() {
    $dataRefreshManager.forceRefresh();
    $scope.$close();
  };
}

function GmapsImporterCtrl($scope, $timeout, $tripPlanService,
    $entityService, $dataRefreshManager, $tripPlanModel) {
  var me = this;
  $scope.url = '';
  $scope.importing = false;
  $scope.saving = false;
  $scope.importAction = 'new';
  $scope.currentTripPlanName = $tripPlanModel.tripPlanData['name'];
  $scope.pendingTripPlan = null;
  $scope.newTripPlan = null;
  $scope.urlInvalid = false;

  $scope.ready = false;
  // HACK: Figure out the right time to set focus.
  $timeout(function() {
    $scope.ready = true;
  }, 100);

  $scope.urlPasted = function() {
    $scope.urlInvalid = false;
    $timeout(function() {
      if (!$scope.url) {
        return;
      }
      $scope.importing = true;
      $tripPlanService.gmapsimport($scope.url)
        .success(function(response) {
          if (response['response_code'] == ResponseCode.SUCCESS) {
            $scope.pendingTripPlan = response['trip_plan'];
            $scope.importing = false;
          } else if (extractError(response, TripPlanServiceError.INVALID_GOOGLE_MAPS_URL)) {
            $scope.urlInvalid = true;
            $scope.importing = false;
          }
        });
      });
  };

  $scope.save = function() {
    if ($scope.importAction == 'new') {
      $scope.savePendingAsNewTripPlan();
    } else if ($scope.importAction == 'import') {
      $scope.importPendingToExistingTrip();
    }
  };

  $scope.savePendingAsNewTripPlan = function() {
    var tripPlan = $scope.pendingTripPlan;
    tripPlan['location_bounds'] = me.computeBoundsFromEntities(tripPlan['entities']);
    $scope.saving = true;
    $tripPlanService.saveNewTripPlan(tripPlan)
      .success(function(newTripPlanResponse) {
        var newTripPlan = newTripPlanResponse['trip_plans'][0];
        $entityService.saveNewEntities(tripPlan['entities'], newTripPlan['trip_plan_id'])
          .success(function(entityResponse) {
            var newEntities = entityResponse['entities'];
            newTripPlan['entities'] = newEntities;
            $scope.newTripPlan = newTripPlan;
            $scope.saving = false;
        });
    });
  };

  $scope.importPendingToExistingTrip = function() {
    var tripPlan = $scope.pendingTripPlan;
    $scope.saving = true;
    $entityService.saveNewEntities(tripPlan['entities'], $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.saving = false;
          $dataRefreshManager.askToRefresh();
          $scope.$close();
        }
      });
  };

  this.computeBoundsFromEntities = function(entities) {
    var gmapsBounds = new google.maps.LatLngBounds();
    $.each(entities, function(i, entity) {
      if (!_.isEmpty(entity['latlng'])) {
        gmapsBounds.extend(gmapsLatLngFromJson(entity['latlng']));
      }
    });
    return boundsJsonFromGmapsBounds(gmapsBounds);
  };
}

// Directives

function tcEntityScroll() {
  return {
    restrict: 'A',
    scope: {
      scrollState: '='
    },
    link: function(scope, elem, attrs) {
      var container = $(elem);
      scope.$watch('scrollState.entityId', function(newEntityId, oldEntityId) {
        if (newEntityId) {
          var entityElem = container.find('[tc-entity-id="' + newEntityId + '"]');
          scrollMapviewToId(container, entityElem);
          scope.scrollState.entityId = null;
        }
      });
    }
  };
}

function scrollMapviewToId(container, scrollDestElem, opt_classToAdd, opt_removeClassAfter) {
  var newScrollTop = container.scrollTop() + scrollDestElem.offset().top - 88;
  if (newScrollTop != 0) {
    container.animate({scrollTop: newScrollTop}, 500);
  }
  if (opt_classToAdd) {
    scrollDestElem.addClass(opt_classToAdd);
    if (opt_removeClassAfter) {
      setTimeout(function() {
        scrollDestElem.removeClass(opt_classToAdd);
      }, opt_removeClassAfter);
    }
  }
}

function tcScrollToSelector($interpolate) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      scope.$watch(attrs.scrollOnChangesTo, function(value) {
        if (value) {
          var selector = $interpolate(attrs.scrollDestSelector)(scope);
          var dest = $(selector);
          var newScrollTop = elem.scrollTop() + dest.offset().top - elem.offset().top;
          elem.animate({scrollTop: newScrollTop}, 500);
        } else {
          elem.animate({scrollTop: 0});
        }
      });
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

function tcStartNewTripInput() {
  return {
    retrict: 'AE',
    templateUrl: 'start-new-trip-input-template',
    controller: StartNewTripInputCtrl,
    scope: {
      onSelectPlace: '&'
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
      onDragend: '&',
      onClear: '&'
    }
  };
}

function tcLockAfterScroll() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var scrollParent = $('#' + attrs.scrollParentId);
      var elem = $(element);
      var spread = elem.offset().top - scrollParent.offset().top;
      var classWhenFixed = attrs.classWhenFixed;
      var parentClassWhenFixed = attrs.parentClassWhenFixed;
      if (attrs.recomputeSpreadOn) {
        scope.$watch(attrs.recomputeSpreadOn, function() {
          spread = elem.offset().top - scrollParent.offset().top;
        });
      }
      scrollParent.on('scroll', function() {
        if (scrollParent.scrollTop() >= spread) {
          if (classWhenFixed) {
            elem.addClass(classWhenFixed);          
          }
          if (parentClassWhenFixed) {
            scrollParent.addClass(parentClassWhenFixed);
          }
        } else {
          if (classWhenFixed) {
            elem.removeClass(classWhenFixed);          
          }
          if (parentClassWhenFixed) {
            scrollParent.removeClass(parentClassWhenFixed);
          }
        }
      });
    }
  };
}

function tcScrollSignal() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var scrollParent = $(attrs.scrollParentSelector);
      var referenceElem = attrs.referenceElemSelector
        ? $(attrs.referenceElemSelector) : scrollParent;

      function computeSpread() {
        var spread = 0;
        if (attrs.signalCondition == 'bottom-to-bottom') {
          spread = elem.offset().top + elem.height() 
            - (referenceElem.offset().top + referenceElem.height());
        }
        return spread;        
      }

      var spread = computeSpread();

      scrollParent.on('scroll', function() {
        if (scrollParent.scrollTop() >= spread) {
          attrs.signalClass && elem.addClass(attrs.signalClass);
          attrs.parentSignalClass && scrollParent.addClass(attrs.parentSignalClass);
          attrs.referenceSignalClass && referenceElem.addClass(attrs.referenceSignalClass);
        } else {
          attrs.signalClass && elem.removeClass(attrs.signalClass);
          attrs.parentSignalClass && scrollParent.removeClass(attrs.parentSignalClass);
          attrs.referenceSignalClass && referenceElem.removeClass(attrs.referenceSignalClass);
        }
      });

      if (attrs.recomputeSpreadOn) {
        scope.$watch(attrs.recomputeSpreadOn, function() {
          spread = computeSpread();
        });
      }
    }
  };
}

function tcCoverScroll() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var inverseElem = $(attrs.animateInverseOn);
      var scrollParent = $(attrs.scrollParentSelector);
      var height = elem.height();
      var startThreshold = height * parseFloat(attrs.startThreshold);
      var easingExponent = parseFloat(attrs.easingExponent);
      scrollParent.on('scroll', function() {
        var scrollTop = scrollParent.scrollTop();
        if (scrollTop < startThreshold) {
          elem.css('opacity', 1);
          inverseElem.css('opacity', 0);
        } else if ((scrollTop + 44) >= height) {
          elem.css('opacity', 0);
          inverseElem.css('opacity', 1);
        } else {
          var opacity = 1 - Math.pow( ((scrollTop - startThreshold) / (height - startThreshold - 44)), easingExponent);
          elem.css('opacity', opacity);
          inverseElem.css('opacity', 1 - opacity);
        }
      });

      if (attrs.recomputeThresholdOn) {
        scope.$watch(attrs.recomputeThresholdOn, function() {
          height = elem.height();
          startThreshold = height * parseFloat(attrs.startThreshold);
        });
      }
    }
  };
}

function tcSetScrollTop($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var scrollTop = parseInt(attrs.setScrollTop);
      scope.$watch(attrs.setScrollOnChangesTo, function(newValue, oldValue) {
        if (newValue === oldValue) {
          return;
        }
        $timeout(function() {
          elem.scrollTop(scrollTop);
        });
      });
    }
  };
}

function tcSaveScrollPosition($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var scrollTop = elem.scrollTop();
      var resetInProgress = false;
      elem.on('scroll', function() {
        if (!resetInProgress) {
          scrollTop = elem.scrollTop();
        }
      });
      scope.$watch(attrs.scrollPositionWatch, function() {
        resetInProgress = true;
        $timeout(function() {
          elem.scrollTop(scrollTop);
          resetInProgress = false;
        });
      });
    }
  };
}

function tcWatchForOverflow($window, $timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var classWhenOverflowing = attrs.classWhenOverflowing;
      scope.$watch(attrs.watchExpr, function(newValue, oldValue) {
        if (elem.hasClass(classWhenOverflowing)) {
          // This is not ideal but right now we say that once the
          // element has overflowed once, it will keep the overflow
          // class indefinitely.  This is because once the overflow
          // class is set, you can't accurately measure the height
          // of the element since it is by design now restricted to
          // the window height.  You would have to remove the overflow
          // class to accurately measure height, but that causes a flicker.
          return;
        }
        $timeout(function() {
          if (elem.prop('scrollHeight') > $window.innerHeight) {
            elem.addClass(classWhenOverflowing);
          } else {
            elem.removeClass(classWhenOverflowing);
          }
        });
      });
    }
  };
}

function tcImageGallery() {
  return {
    retrict: 'AEC',
    templateUrl: 'image-gallery-template',
    scope: {
      urls: '=',
      pageSize: '='
    },
    controller: function($scope) {
      $scope.currentPage = 0;
      $scope.selectedImgIndex = 0;

      $scope.featuredImgUrl = function() {
        return $scope.urls[$scope.selectedImgIndex];
      };

      $scope.imgsToShow = function() {
        var startIndex = $scope.currentPage * $scope.pageSize;
        return $scope.urls.slice(startIndex, startIndex + $scope.pageSize);
      };

      $scope.hasNextPage = function() {
        return ($scope.currentPage + 1) * $scope.pageSize < $scope.urls.length;
      };

      $scope.hasPrevPage = function() {
        return $scope.currentPage > 0 && $scope.urls.length > $scope.pageSize;
      };

      $scope.nextPage = function() {
        $scope.currentPage++;
      };

      $scope.prevPage = function() {
        $scope.currentPage--;
      };

      $scope.showSelector = function() {
        return $scope.urls.length > 1;
      };

      $scope.selectImg = function(index) {
        console.log(index);
        $scope.selectedImgIndex = index;
      };

      $scope.advanceImg = function() {
        if ($scope.selectedImgIndex + 1 < $scope.urls.length) {
          $scope.selectedImgIndex++;
          if ($scope.selectedImgIndex == ($scope.pageSize) * ($scope.currentPage + 1)) {
            $scope.currentPage++;
          }
        }
      };

      $scope.selectorImgMaxWidth = function() {
        return Math.floor(100 / $scope.pageSize) + '%';
      };
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
    restrict: 'A',
    link: function(scope, element, attrs, model) {
      var placeChangeFn = $parse(attrs.onPlaceChange);
      var types = attrs.locationTypes ? attrs.locationTypes.split(',') : [];
      var options = {
        types: types,
        componentRestrictions: {}
      };
      var gPlace = new google.maps.places.Autocomplete(element[0], options);

      scope.$watch(attrs.searchBoundsJson, function(value, oldValue) {
        if (value) {
          gPlace.setBounds(gmapsBoundsFromJson(value));
        }
      });

      google.maps.event.addListener(gPlace, 'place_changed', function() {
        if (placeChangeFn) {
          scope.$apply(function() {
            placeChangeFn(scope, {$newPlace: gPlace.getPlace()});
          });
        };
      });
    }
  };
}

function tcGoogleMap() {
  return {
    restrict: 'AE',
    scope: {
      map: '=',
      mapOptions: '=',
      resizeWhen: '=',
      afterCreation: '&'
    },
    link: function(scope, element, attrs) {
      var mapOptions = scope.mapOptions || {};
      var map = scope.map = new google.maps.Map(element[0], mapOptions);
      scope.$watch('resizeWhen', function(newValue) {
        if (newValue) {
          var oldCenter = map.getCenter();
          google.maps.event.trigger(map, 'resize');
          map.setCenter(oldCenter);
        }
      });
      scope.afterCreation({$map: map});
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
  .directive('tcStarRating', tcStarRating)
  .directive('bnLazySrc', bnLazySrc)
  .directive('tcGooglePlaceAutocomplete', tcGooglePlaceAutocomplete)
  .directive('tcGoogleMap', tcGoogleMap)
  .directive('tcDrop', directiveForEvent('drop'))
  .directive('tcDragenter', directiveForEvent('dragenter'))
  .directive('tcDragstart', directiveForEvent('dragstart'))
  .directive('tcDragleave', directiveForEvent('dragleave'))
  .directive('tcDragover', directiveForEvent('dragover'))
  .directive('tcDragend', directiveForEvent('dragend'))
  .directive('tcFocusOn', tcFocusOn)
  .directive('tcLockAfterScroll', tcLockAfterScroll)
  .directive('tcSetScrollTop', tcSetScrollTop)
  .directive('tcSaveScrollPosition', tcSaveScrollPosition)
  .directive('tcWatchForOverflow', tcWatchForOverflow)
  .directive('tcImageGallery', tcImageGallery)
  .directive('tcScrollToSelector', tcScrollToSelector)
  .directive('tcScrollSignal', tcScrollSignal)
  .directive('tcTripPlanSelectDropdown', tcTripPlanSelectDropdown);

function makeFilter(fn) {
  return function() {
    return fn;
  };
}

angular.module('filtersModule', [])
  .filter('hostname', makeFilter(hostnameFromUrl))
  .filter('hostNoSuffix', makeFilter(hostNoSuffix))
  .filter('emailPrefix', makeFilter(emailPrefix))
  .filter('hostToIcon', makeFilter(hostToIcon));

window['initApp'] = function(tripPlan, entities, notes, allTripPlans,
    accountInfo, datatypeValues, allowEditing, sampleSites, initialState) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanModel', new TripPlanModel(tripPlan, entities, notes))
    .value('$allTripPlans', allTripPlans)
    .value('$pageStateModel', PageStateModel.fromInitialState(initialState))
    .value('$taxonomy', new TaxonomyTree(datatypeValues['categories'], datatypeValues['sub_categories']))
    .value('$accountInfo', accountInfo)
    .value('$allowEditing', allowEditing)
    .value('$sampleSites', sampleSites);

  angular.module('mapModule', [])
    .value('$map', createMap(tripPlan))
    .value('$mapBounds', new google.maps.LatLngBounds());

  angular.module('appModule', ['mapModule', 'initialDataModule', 'entityResultModule',
      'servicesModule', 'directivesModule', 'filtersModule', 'ui.bootstrap', 'ngSanitize'],
      interpolator)
    .controller('RootCtrl', ['$scope', '$http', '$timeout', '$modal',
      '$tripPlanService', '$tripPlanModel', '$tripPlan', '$map', '$mapBounds', '$pageStateModel',
      '$entityService', '$allowEditing', '$sce', RootCtrl])
    .controller('AccountDropdownCtrl', ['$scope', '$accountService', '$tripPlanService', '$accountInfo',
      '$tripPlan', '$allTripPlans', AccountDropdownCtrl])
    .controller('ItemGroupCtrl', ['$scope', ItemGroupCtrl])
    .controller('GuideviewItemGroupCtrl', ['$scope', GuideviewItemGroupCtrl])
    .controller('EntityCtrl', ['$scope', '$entityService', '$modal',
      '$dataRefreshManager', '$pagePositionManager', '$tripPlanModel', '$pageStateModel', '$timeout',
      '$map', '$mapBounds', '$templateToStringRenderer', EntityCtrl])
    .controller('GuideviewEntityCtrl', ['$scope', GuideviewEntityCtrl])
    .controller('MarkerToolsCtrl', ['$scope', MarkerToolsCtrl])
    .controller('NoteCtrl', ['$scope', '$noteService', '$tripPlanModel', NoteCtrl])
    .controller('ReclipConfirmationCtrl', ['$scope', '$timeout', '$entityService', ReclipConfirmationCtrl])
    .controller('CarouselCtrl', ['$scope', CarouselCtrl])
    .controller('AddPlacePanelCtrl', ['$scope', '$timeout', '$tripPlanModel',
     '$sampleSites', '$entityService', '$dataRefreshManager', AddPlacePanelCtrl])
    .controller('AddPlaceConfirmationCtrl', ['$scope','$timeout', '$entityService',
      '$dataRefreshManager', '$tripPlan', '$taxonomy', AddPlaceConfirmationCtrl])
    .controller('EditImagesCtrl', ['$scope', '$timeout', EditImagesCtrl])
    .controller('DayPlannerCtrl', ['$scope', '$entityService', '$noteService',
      '$tripPlanModel', '$dataRefreshManager', DayPlannerCtrl])
    .controller('DayPlannerOneDayCtrl', ['$scope', DayPlannerOneDayCtrl])
    .controller('GmapsImporterCtrl', ['$scope', '$timeout', '$tripPlanService',
      '$entityService', '$dataRefreshManager', '$tripPlanModel', GmapsImporterCtrl])
    .directive('tcItemDropTarget', tcItemDropTarget)
    .directive('tcDraggableEntity', tcDraggableEntity)
    .directive('tcEntityScroll', tcEntityScroll)
    .directive('tcStartNewTripInput', tcStartNewTripInput)
    .directive('tcCoverScroll', tcCoverScroll)
    .service('$templateToStringRenderer', TemplateToStringRenderer)
    .service('$dataRefreshManager', DataRefreshManager)
    .service('$pagePositionManager', PagePositionManager);

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
