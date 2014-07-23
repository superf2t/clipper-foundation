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

function creatorDisplayName(tripPlanData) {
  if (!tripPlanData) {
    return null;
  }
  if (tripPlanData['user'] && tripPlanData['user']['display_name']) {
    return tripPlanData['user']['display_name'];
  } else if (tripPlanData['creator'] && _.isString(tripPlanData['creator'])) {
    return emailPrefix(tripPlanData['creator']);
  } else {
    return 'Guest User';
  }
}

function EntityModel(entityData, editable) {
  this.data = entityData;

  this.entityId = function() {
    return this.data['entity_id'];
  };

  this.hasDescription = function() {
    return this.data['description'] && this.data['description'].length;
  };

  this.isPreciseLocation = function() {
    return this.data['address_precision'] == 'Precise';
  };

  this.hasLocation = function() {
    return !!this.data['latlng'];
  };

  this.gmapsLatLng = function() {
    if (!this.data['latlng']) {
      return null;
    }
    return new google.maps.LatLng(this.data['latlng']['lat'], this.data['latlng']['lng']);
  };
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

  this.entities = function() {
    return this.entityDatas;
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

  this.hasDescription = function() {
    return this.tripPlanData['description'];
  };

  this.hasSource = function() {
    return !!this.tripPlanData['source_url'];
  };

  this.locationLatlng = function() {
    return this.tripPlanData['location_latlng'];
  };

  this.getMapBounds = function() {
    if (this.numEntities() < 2) {
      if (this.tripPlanData['location_bounds']) {
        return gmapsBoundsFromJson(this.tripPlanData['location_bounds']);
      } else {
        return null;
      }
    }
    var bounds = new google.maps.LatLngBounds();
    $.each(this.entityDatas, function(i, entityData) {
      if (!_.isEmpty(entityData['latlng'])) {
        bounds.extend(gmapsLatLngFromJson(entityData['latlng']));
      }
    });
    return bounds;
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

  this.addNewEntities = function(entityDatas) {
    this.entityDatas.push.apply(this.entityDatas, entityDatas);
    $.each(entityDatas, function(i, entityData) {
      me.entitiesById[entityData['entity_id']] = entityData;
      me.dayPlannerModel.insertNewItem(new ItemModel(entityData));
    });
  };

  this.removeEntities = function(entityDatas) {
    $.each(entityDatas, function(i, entityData) {
      for (var j = 0; j < me.entityDatas.length; j++) {
        if (me.entityDatas[j]['entity_id'] == entityData['entity_id']) {
          me.entityDatas.splice(j, 1);
          break;
        }
      }
      delete me.entitiesById[entityData['entity_id']];
      me.dayPlannerModel.removeItem(new ItemModel(entityData));
    });
  };

  this.addNewComments = function(comments) {
    $.each(comments, function(i, comment) {
      var entity = me.entitiesById[comment['entity_id']];
      if (!entity['comments']) {
        entity['comments'] = [];
      }
      entity['comments'].push(comment);
    });
  };

  this.updateComments = function(comments) {
    $.each(comments, function(i, comment) {
      var entity = me.entitiesById[comment['entity_id']];
      $.each(entity['comments'], function(j, existingComment) {
        if (existingComment['comment_id'] == comment['comment_id']) {
          entity['comments'][j] = comment;
        }
      });
    });
  };

  this.removeComments = function(comments) {
    $.each(comments, function(i, comment) {
      var entity = me.entitiesById[comment['entity_id']];
      for (var j = 0, J = entity['comments'].length; j < J; j++) {
        if (entity['comments'][j]['comment_id'] == comment['comment_id']) {
          entity['comments'].splice(j, 1);
          break;
        }
      }
    });
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

  this.updateCollaborators = function(tripPlanCollaborators) {
    this.tripPlanData['editors'] = tripPlanCollaborators['editors'];
    this.tripPlanData['invitee_emails'] = tripPlanCollaborators['invitee_emails'];
  };

  this.updateTripPlan = function(tripPlanData) {
    $.extend(this.tripPlanData, tripPlanData);
  };

  this.updateLastModified = function(lastModified) {
    if (lastModified) {
      this.tripPlanData['last_modified'] = lastModified;
    }
  };

  this.userStyleIdentifier = function(publicUserId) {
    if (this.tripPlanData['user']['public_id'] == publicUserId) {
      return 1;
    }
    for (var i = 0, I = this.tripPlanData['editors'].length; i < I; i++) {
      var editor = this.tripPlanData['editors'][i];
      if (editor['public_id'] == publicUserId) {
        return 2 + i;
      }
    }
    return null;
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

function ItemGroupCtrl($scope, $tripPlanModel, $map, $filterModel) {
  $scope.show = function() {
    if ($scope.itemGroupModel.grouping == Grouping.CATEGORY) {
      return $filterModel.isCategoryNameSelected($scope.itemGroupModel.groupKey);
    } else if ($scope.itemGroupModel.grouping == Grouping.DAY) {
      return $filterModel.isDaySelected($scope.itemGroupModel.groupKey);
    }
    return true;
  };

  $scope.centerMapOnGroup = function() {
    $scope.$emit('asktocloseallinfowindows');
    var bounds = new google.maps.LatLngBounds()
    $.each($scope.itemGroupModel.getEntityItems(), function(i, item) {
      if (item.hasLocation()) {
        bounds.extend(gmapsLatLngFromJson(item.data['latlng']));
      }
    });
    if (!bounds.isEmpty()) {
      $map.fitBounds(bounds);
    }
  };
}

function EntityCtrl($scope, $entityService, $modal,
    $pagePositionManager, $tripPlanModel, $pageStateModel, $filterModel,
    $timeout, $map, $templateToStringRenderer, $window) {
  var me = this;
  $scope.ed = $scope.item.data;
  var entityModel = new EntityModel($scope.item.data);
  $scope.InlineEditMode = InlineEditMode;

  $scope.controlState = {
    open: false,
    showSecondaryControls: false
  };

  $scope.openControls = function() {
    $scope.$emit('asktocloseallcontrols');
    $scope.controlState.open = true;
    $scope.controlState.showSecondaryControls = false;
  };

  $scope.closeControls = function() {
    $scope.controlState.open = false;
    $scope.controlState.showSecondaryControls = false;
  };

  $scope.$on('closeallcontrols', function() {
    $scope.closeControls();
  });

  this.iconTemplateName = function() {
    if ($scope.ed['sub_category'] && $scope.ed['sub_category']['sub_category_id']) {
      return $scope.ed['sub_category']['name'] + '-icon-template';
    }
    if ($scope.ed['category'] && $scope.ed['category']['category_id']) {
      return $scope.ed['category']['name'] + '-icon-template';
    }
    return null;
  };

  $scope.map = $map;
  $scope.position = entityModel.gmapsLatLng();
  $scope.markerState = {
    marker: null,
    iconTemplateName: this.iconTemplateName(),
    emphasized: false,
    deemphasized: false
  };

  $scope.openEditPlaceModal = function(windowClass) {
    var scope = $scope.$new(true);
    scope.ed = angular.copy($scope.ed);
    $modal.open({
      templateUrl: 'edit-place-modal-template',
      windowClass: windowClass,
      scope: scope
    });
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
    var ok = $window.confirm('Are you sure you want to delete this place?');
    if (!ok) {
      return;
    }
    $entityService.deleteEntity($scope.item.data, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.removeEntities(response['entities']);
          $scope.$emit('redrawgroupings');
        } else {
          alert('Failed to delete entity');
        }
      }).error(function() {
        alert('Failed to delete entity')
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

  $scope.openInlineEdit = function(inlineEditMode) {
    $pageStateModel.midPanelExpanded = true;
    $pageStateModel.midPanelMode = MidPanelMode.GUIDE;
    $scope.selectEntity($scope.ed);
    $scope.$emit('asktoopeninlineedit', $scope.ed['entity_id'], inlineEditMode);
  };

  // Map and Marker Controls

  var infowindow = null;
  $scope.infowindowOpen = false;

  this.createInfowindow = function() {
    var scope = $scope.$new();
    var contentDiv = $templateToStringRenderer.render('infowindow-template', scope);
    var overlay = new HtmlInfowindow($scope.markerState.marker, contentDiv);
    scope.onSizeChange = function() {
      overlay.draw();
    };
    return overlay;
  };

  this.destroyInfowindow = function() {
    if (infowindow) {
      infowindow.setMap(null);
      infowindow = null;
    }
  };

  $scope.$on('$destroy', function() {
    me.destroyInfowindow();
  });

  this.setMarkerState = function() {
    if (!$scope.markerState.marker) {
      return;
    }
    var categorySelected = !$scope.ed['category'] || $filterModel.isCategorySelected($scope.ed['category']);
    var daySelected = !$scope.ed['day'] || $filterModel.isDaySelected($scope.ed['day']);
    var selected = categorySelected && daySelected;
    $scope.markerState.marker.setMap(selected ? $map : null);
    if ($filterModel.emphasisActive()) {
      var dayEmphasized = $scope.ed['day'] && ($scope.ed['day'] == $filterModel.emphasizedDayNumber);
      $scope.markerState.emphasized = dayEmphasized;
      $scope.markerState.deemphasized = !dayEmphasized;
    } else {
      $scope.markerState.emphasized = false;
      $scope.markerState.deemphasized = false;
    }
    if (!selected) {
      me.destroyInfowindow();
      if ($pageStateModel.entityIsSelected($scope.ed['entity_id'])) {
        $pageStateModel.selectedEntity = null;
        $scope.infowindowOpen = false;
      }
    }
  };

 $scope.$watch(_.constant($filterModel), this.setMarkerState, true);
 $timeout(this.setMarkerState);

  $scope.markerClicked = function($event) {
    $scope.selectEntity($scope.ed);  // parent scope method
    $scope.openInfowindow();
    $event.stopPropagation();
  };

  $scope.openInfowindow = function() {
    $scope.$emit('asktocloseallinfowindows');
    if (entityModel.hasLocation()) {
      infowindow = me.createInfowindow();
      $scope.infowindowOpen = true;
    }
  };

  $scope.$on('closeallinfowindows', function() {
    $scope.infowindowOpen = false;
    me.destroyInfowindow();
  });

  $scope.$on('emphasizemarkers', function() {
    $scope.markerState.emphasized = true;
  });
}

var InlineEditMode = {
  COMMENTS: 1,
  DAY_PLANNER: 2,
  DIRECTIONS: 3
};

function GuideviewEntityCtrl($scope, $entityService, $tripPlanModel,
    $filterModel, $accountInfo, $modal, $window) {
  $scope.ed = $scope.item.data;
  $scope.show = true;
  $scope.inlineEditMode = null;
  $scope.InlineEditMode = InlineEditMode;

  $scope.showSecondaryControls = false;

  $scope.allEntities = $tripPlanModel.entities();
  $scope.directionsState = {
    direction: 'from',
    destination: null
  };

  $scope.toggleDirectionsDirection = function() {
    $scope.directionsState.direction = 
      $scope.directionsState.direction == 'to' ? 'from' : 'to';
  };

  $scope.getDirections = function() {
    if (!$scope.directionsState.destination) {
      return;
    }
    var origin = $scope.directionsState.direction == 'to'
      ? $scope.ed : $scope.directionsState.destination;
    var destination = $scope.directionsState.direction == 'to'
      ? $scope.directionsState.destination : $scope.ed;
    var url = 'https://www.google.com/maps/dir/' + 
      new ItemModel(origin).latlngString() + '/' +
      new ItemModel(destination).latlngString();
    $window.open(url, '_blank');
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

  $scope.reclipEntity = function() {
    var scope = $scope.$new(true);
    scope.entityModel = new EntityModel(angular.copy($scope.ed));
    scope.ed = scope.entityModel.data;
    scope.ed['entity_id'] = null;
    $modal.open({
      templateUrl: 'reclip-confirmation-template',
      scope: scope
    });
  };

  $scope.deleteEntity = function() {
    var ok = $window.confirm('Are you sure you want to delete this place?');
    if (!ok) {
      return;
    }
    $entityService.deleteEntity($scope.ed, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.removeEntities(response['entities']);
          $scope.$emit('redrawgroupings');
        } else {
          alert('Failed to delete entity');
        }
      }).error(function() {
        alert('Failed to delete entity')
      });
  };

  $scope.openEditPlaceModal = function(windowClass) {
    var scope = $scope.$new(true);
    scope.ed = angular.copy($scope.ed);
    $modal.open({
      templateUrl: 'edit-place-modal-template',
      windowClass: windowClass,
      scope: scope
    });   
  };

  $scope.toggleInlineEdit = function(inlineEditMode) {
    if ($scope.inlineEditMode == inlineEditMode) {
      $scope.inlineEditMode = null;
    } else {
      if (!$accountInfo['logged_in']
        && inlineEditMode == InlineEditMode.COMMENTS) {
        $window.alert('Please log in before making comments.');
        return;
      }

      $scope.inlineEditMode = inlineEditMode;
      if (inlineEditMode == InlineEditMode.COMMENTS) {
        $scope.closeCommentEdit();
        $scope.newComment = {
          'entity_id': $scope.ed['entity_id'],
          'text': ''
        };
      }
    }
  };

  $scope.closeInlineEditor = function() {
    $scope.inlineEditMode = null;
  };

  $scope.$on('openinlineedit', function($event, entityId, inlineEditMode) {
    if ($scope.ed['entity_id'] != entityId) {
      return;
    }
    $scope.inlineEditMode = null;
    $scope.toggleInlineEdit(inlineEditMode);
  });

  $scope.$on('closeallcontrols', function() {
    $scope.inlineEditMode = null;
    $scope.closeCommentEdit();
  });

  $scope.saveNewComment = function() {
    if (!$scope.newComment['text']) {
      return;
    }
    $entityService.addComment($scope.newComment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.addNewComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          $scope.closeInlineEditor();
        }
      });
  };

  $scope.saveCommentEdit = function() {
    if (!$scope.editingComment || !$scope.editingComment['text']) {
      return;
    }
    $entityService.editComment($scope.editingComment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          $scope.closeCommentEdit();
        }
      });
  };

  $scope.deleteComment = function(comment) {
    if (!$window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    $entityService.deleteComment(comment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.removeComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          $scope.closeCommentEdit();
        }
      });
  };

  $scope.openCommentEdit = function(comment) {
    $scope.editingComment = angular.copy(comment);
    $scope.closeInlineEditor();
  };

  $scope.closeCommentEdit = function() {
    $scope.editingComment = null;
  };

  $scope.show = function() {
    var categorySelected = !$scope.ed['category'] || $filterModel.isCategorySelected($scope.ed['category']);
    var daySelected = !$scope.ed['day'] || $filterModel.isDaySelected($scope.ed['day']);
    return categorySelected && daySelected;
  };

  $scope.toggleControls = function() {
    $scope.showSecondaryControls = !$scope.showSecondaryControls;
  };
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

function DaySelectDropdownCtrl($scope, $tripPlanModel, $entityService,
    $dataRefreshManager, $pageStateModel, $pagePositionManager, $timeout) {
  $scope.selectedDayState = {dayModel: null};
  if ($scope.ed['day']) {
    $scope.selectedDayState.dayModel =
      $tripPlanModel.dayPlannerModel.dayModelForDay($scope.ed['day']);
  }

  $scope.getDaySelectOptions = function() {
    var daySelectOptions = $tripPlanModel.dayPlannerModel.dayModels.slice(0);
    daySelectOptions.push({createNew: true});
    return daySelectOptions;
  };

  $scope.organizeIntoDay = function(opt_callback) {
    var dayPlannerModel = $tripPlanModel.dayPlannerModel;
    var item = dayPlannerModel.findItemByEntityId($scope.ed['entity_id']);
    var dayModel = $scope.selectedDayState.dayModel =
      $scope.selectedDayState.dayModel.createNew
      ? dayPlannerModel.addNewDay() : $scope.selectedDayState.dayModel;
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
        $scope.onSelect && $scope.onSelect();
      }).error(function() {
        $dataRefreshManager.unfreeze();
      });
  };
}

function tcDaySelectDropdown() {
  return {
    restrict: 'AE',
    scope: {
      'ed': '=entityData',
      'onSelect': '&'
    },
    templateUrl: 'day-select-dropdown-template',
    controller: DaySelectDropdownCtrl
  };
}

function InfowindowCtrl($scope, $tripPlanModel, $entityService,
    $accountInfo, $window, $timeout) {
  $scope.inlineEditMode = null;
  $scope.InlineEditMode = InlineEditMode;

  $scope.allEntities = $tripPlanModel.entities();
  $scope.directionsState = {
    direction: 'from',
    destination: null
  };

  $scope.showPrimaryControls = true;
  $scope.showSecondaryControls = false;

  $scope.toggleDirectionsDirection = function() {
    $scope.directionsState.direction = 
      $scope.directionsState.direction == 'to' ? 'from' : 'to';
  };

  $scope.getDirections = function() {
    if (!$scope.directionsState.destination) {
      return;
    }
    var origin = $scope.directionsState.direction == 'to'
      ? $scope.ed : $scope.directionsState.destination;
    var destination = $scope.directionsState.direction == 'to'
      ? $scope.directionsState.destination : $scope.ed;
    var url = 'https://www.google.com/maps/dir/' + 
      new ItemModel(origin).latlngString() + '/' +
      new ItemModel(destination).latlngString();
    $window.open(url, '_blank');
  };

  $scope.saveNewComment = function() {
    if (!$scope.newComment['text']) {
      return;
    }
    $entityService.addComment($scope.newComment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.addNewComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          $scope.closeInlineEditor();
        }
      });
  };

  $scope.showInfoSection = function() {
    return $scope.ed['day'] || $scope.ed['starred'] || $scope.ed['address_precision'] == 'Imprecise';
  };

  $scope.workspaceActive = function() {
    return !!$scope.inlineEditMode;
  };

  $scope.toggleInlineEdit = function(inlineEditMode) {
    if ($scope.inlineEditMode == inlineEditMode) {
      $scope.inlineEditMode = null;
    } else {
      if (!$accountInfo['logged_in']
        && inlineEditMode == InlineEditMode.COMMENTS) {
        $window.alert('Please log in before making comments.');
        return;
      }

      $scope.inlineEditMode = inlineEditMode;
      if (inlineEditMode == InlineEditMode.COMMENTS) {
        $scope.newComment = {
          'entity_id': $scope.ed['entity_id'],
          'text': ''
        };
      }
    }
    $timeout($scope.onSizeChange);
  };

  $scope.closeInlineEditor = function() {
    $scope.inlineEditMode = null;
    $timeout($scope.onSizeChange);
  };

  $scope.toggleControls = function() {
    $scope.showPrimaryControls = !$scope.showPrimaryControls;
    $scope.showSecondaryControls = !$scope.showSecondaryControls;
  };
}

// A map marker whose content can be arbitrary html rather
// than just an image.
// This class is very similar to that in 
// https://code.google.com/p/google-maps-utility-library-v3/source/browse/trunk/richmarker/src/richmarker.js
// However it was implemented independently and RichMarker
// doesn't behave as well with regard to markers changing size
// using CSS transitions.  It would be nice to see if the two
// classes could be reconciled at some point though.
// The dragging functionality in HtmlMarker is taken nearly verbatim
// from RichMarker however.
HtmlMarker.prototype = new google.maps.OverlayView();

function HtmlMarker(position, map, contentDiv, opt_options) {
  this.position = position;
  this.map = map;
  this.options = opt_options || {};

  this.ready_ = false;
  this.dragging_ = false;

  this.div =  $('<div>').css('position', 'absolute').append(
    $('<div>').css({
      'position': 'absolute',
      'bottom': 0,
      'pointer-events': 'none'
    }).append(
      $('<div>').css({
        'position': 'relative',
        'left': '-50%',
        'pointer-events': 'auto'
      }).append(contentDiv)));
  var elem = $(contentDiv);
  this.sizeDiv = elem.height() ? elem : $(elem.children()[0])
  this.markerWrapper_ = this.div[0];
  map && this.setMap(map);
}

// Override
HtmlMarker.prototype.setMap = function(map) {
  if (map === this.getMap()) {
    return;
  }
  google.maps.OverlayView.prototype.setMap.call(this, map);
};

// Override
HtmlMarker.prototype.onAdd = function() {
  this.getPanes().overlayMouseTarget.appendChild(this.div[0]);
  this.ready_ = true;
  this.draggableChanged();
};

// Override
HtmlMarker.prototype.draw = function() {
  var overlayProjection = this.getProjection();
  var point = overlayProjection.fromLatLngToDivPixel(this.position);
  var zIndex = Math.floor(point.y);
  if (this.options.zIndexPlane) {
    zIndex += 1000 * this.options.zIndexPlane;
  }
  this.div.css({
    'left': point.x,
    'top': point.y,
    'z-index': zIndex
  });
};

// Override
HtmlMarker.prototype.onRemove = function() {
  this.div.detach();
};

HtmlMarker.prototype.getHeight = function() {
  return this.sizeDiv.height();
};

HtmlMarker.prototype.getPosition = function() {
  return this.position;
};

HtmlMarker.prototype.setPosition = function(position) {
  this.position = position;
  if (this.ready_) {
    this.draw();
  }
};

HtmlMarker.prototype.getDraggable = function() {
  return this.options.draggable;
};

HtmlMarker.prototype.setDraggable = function(draggable) {
  this.options.draggable = draggable;
  this.draggableChanged();
};

HtmlMarker.prototype.setCursor_ = function(whichCursor) {
  if (!this.ready_) {
    return;
  }

  var cursor = '';
  if (navigator.userAgent.indexOf('Gecko/') !== -1) {
    // Moz has some nice cursors :)
    if (whichCursor == 'dragging') {
      cursor = '-moz-grabbing';
    }

    if (whichCursor == 'dragready') {
      cursor = '-moz-grab';
    }

    if (whichCursor == 'draggable') {
      cursor = 'pointer';
    }
  } else {
    if (whichCursor == 'dragging' || whichCursor == 'dragready') {
      cursor = 'move';
    }

    if (whichCursor == 'draggable') {
      cursor = 'pointer';
    }
  }

  if (this.markerWrapper_.style.cursor != cursor) {
    this.markerWrapper_.style.cursor = cursor;
  }
};

HtmlMarker.prototype.startDrag = function(e) {
  if (!this.getDraggable()) {
    return;
  }

  if (!this.dragging_) {
    this.dragging_ = true;
    var map = this.getMap();
    this.mapDraggable_ = map.get('draggable');
    map.set('draggable', false);

    // Store the current mouse position
    this.mouseX_ = e.clientX;
    this.mouseY_ = e.clientY;

    this.setCursor_('dragready');

    // Stop the text from being selectable while being dragged
    this.markerWrapper_.style['MozUserSelect'] = 'none';
    this.markerWrapper_.style['KhtmlUserSelect'] = 'none';
    this.markerWrapper_.style['WebkitUserSelect'] = 'none';

    this.markerWrapper_['unselectable'] = 'on';
    this.markerWrapper_['onselectstart'] = function() {
      return false;
    };

    this.addDraggingListeners_();

    google.maps.event.trigger(this, 'dragstart');
  }
};

HtmlMarker.prototype.stopDrag = function() {
  if (!this.getDraggable()) {
    return;
  }

  if (this.dragging_) {
    this.dragging_ = false;
    this.getMap().set('draggable', this.mapDraggable_);
    this.mouseX_ = this.mouseY_ = this.mapDraggable_ = null;

    // Allow the text to be selectable again
    this.markerWrapper_.style['MozUserSelect'] = '';
    this.markerWrapper_.style['KhtmlUserSelect'] = '';
    this.markerWrapper_.style['WebkitUserSelect'] = '';
    this.markerWrapper_['unselectable'] = 'off';
    this.markerWrapper_['onselectstart'] = function() {};

    this.removeDraggingListeners_();

    this.setCursor_('draggable');
    google.maps.event.trigger(this, 'dragend');

    this.draw();
  }
};

HtmlMarker.prototype.drag = function(e) {
  if (!this.getDraggable() || !this.dragging_) {
    // This object isn't draggable or we have stopped dragging
    this.stopDrag();
    return;
  }

  var dx = this.mouseX_ - e.clientX;
  var dy = this.mouseY_ - e.clientY;

  this.mouseX_ = e.clientX;
  this.mouseY_ = e.clientY;

  var left = parseInt(this.markerWrapper_.style['left'], 10) - dx;
  var top = parseInt(this.markerWrapper_.style['top'], 10) - dy;

  this.markerWrapper_.style['left'] = left + 'px';
  this.markerWrapper_.style['top'] = top + 'px';

  var point = new google.maps.Point(left, top);
  var projection = this.getProjection();
  this.position = projection.fromDivPixelToLatLng(point);

  this.setCursor_('dragging');
  google.maps.event.trigger(this, 'drag');
};

HtmlMarker.prototype.removeDragListeners_ = function() {
  if (this.draggableListener_) {
    google.maps.event.removeListener(this.draggableListener_);
    delete this.draggableListener_;
  }
  this.setCursor_('');
};

HtmlMarker.prototype.addDragging_ = function(node) {
  if (!node) {
    return;
  }

  var that = this;
  this.draggableListener_ =
    google.maps.event.addDomListener(node, 'mousedown', function(e) {
      that.startDrag(e);
    });

  this.setCursor_('draggable');
};

HtmlMarker.prototype.addDraggingListeners_ = function() {
  var that = this;
  if (this.markerWrapper_.setCapture) {
    this.markerWrapper_.setCapture(true);
    this.draggingListeners_ = [
      google.maps.event.addDomListener(this.markerWrapper_, 'mousemove', function(e) {
        that.drag(e);
      }, true),
      google.maps.event.addDomListener(this.markerWrapper_, 'mouseup', function() {
        that.stopDrag();
        that.markerWrapper_.releaseCapture();
      }, true)
    ];
  } else {
    this.draggingListeners_ = [
      google.maps.event.addDomListener(window, 'mousemove', function(e) {
        that.drag(e);
      }, true),
      google.maps.event.addDomListener(window, 'mouseup', function() {
        that.stopDrag();
      }, true)
    ];
  }
};

HtmlMarker.prototype.removeDraggingListeners_ = function() {
  if (this.draggingListeners_) {
    for (var i = 0, listener; listener = this.draggingListeners_[i]; i++) {
      google.maps.event.removeListener(listener);
    }
    this.draggingListeners_.length = 0;
  }
};

HtmlMarker.prototype.draggableChanged = function() {
  if (this.ready_) {
    if (this.getDraggable()) {
      this.addDragging_(this.markerWrapper_);
    } else {
      this.removeDragListeners_();
    }
  }
};


function tcEntityMarker() {
  return {
    restrict: 'AE',
    scope: {
      size: '=',
      map: '=',
      marker: '=',
      position: '=',
      categoryName: '=',
      iconTemplateName: '=',
      precise: '=',
      starred: '=',
      hasComments: '=',
      emphasized: '=',
      deemphasized: '=',
      draggable: '=',
      onDragEnd: '&',
      selected: '&',
      onClick: '&'
    },
    templateUrl: 'entity-marker-template',
    controller: function($scope) {
      $scope.getClasses = function() {
        var classes = [];
        if ($scope.categoryName) {
          classes.push($scope.categoryName);
        }
        if ($scope.selected()) {
          classes.push('selected');
        }
        if ($scope.emphasized) {
          classes.push('emphasized');
        }
        if ($scope.deemphasized) {
          classes.push('deemphasized');
        }
        return classes;
      };
    },
    link: function(scope, element, attrs) {
      scope.marker = new HtmlMarker(scope.position, scope.map, element[0], {
        draggable: scope.draggable
      });
      scope.$watch('position', function(newValue) {
        if (newValue) {
          scope.marker.setPosition(newValue);
        }
      });
      if (scope.draggable) {
        google.maps.event.addListener(scope.marker, 'dragend', function() {
          scope.onDragEnd({$position: scope.marker.getPosition()});
          scope.$apply();
        });
      }

      scope.$on('$destroy', function() {
        scope.marker.setMap(null);
      });
    }
  };
}

function tcEntityIcon() {
  return {
    restrict: 'AE',
    scope: {
      precise: '=',
      categoryName: '=',
      iconTemplateName: '='
    },
    controller: function($scope) {
      $scope.getClasses = function() {
        var classes = [];
        if ($scope.categoryName) {
          classes.push($scope.categoryName);
        }
        return classes;
      };
    },
    templateUrl: 'entity-marker-template'
  };
}

function tcSearchResultMarker() {
  return {
    restrict: 'AE',
    scope: {
      marker: '=',
      position: '=',
      map: '=',
      precise: '=',
      resultLetter: '=',
      selected: '&',
      emphasized: '&',
      onClick: '&'
    },
    templateUrl: 'search-result-marker-template',
    controller: function($scope) {
      $scope.getClasses = function() {
        var classes = [];
        if ($scope.selected()) {
          classes.push('selected');
        }
        if ($scope.emphasized()) {
          classes.push('emphasized');
        }
        return classes;
      };

      $scope.$on('$destroy', function() {
        $scope.marker.setMap(null);
      });
    },
    link: function(scope, element, attrs) {
      scope.marker = new HtmlMarker(scope.position, scope.map, element[0], {
        zIndexPlane: 1
      });
    }
  };
}

function tcSearchResultIcon() {
  return {
    restrict: 'AE',
    scope: {
      precise: '=',
      resultLetter: '=',
      selected: '&'
    },
    controller: function($scope) {
      $scope.getClasses = function() {
        var classes = [];
        if ($scope.selected()) {
          classes.push('selected');
        }
        return classes;
      };
    },
    templateUrl: 'search-result-marker-template'
  };
}

function tcUserIcon() {
  return {
    restrict: 'AE',
    scope: {
      user: '=',  // A DisplayUser object
      noTooltip: '='
    },
    controller: function($scope, $tripPlanModel) {
      $scope.userStyleIdentifier = function() {
        return $tripPlanModel.userStyleIdentifier($scope.user['public_id']);
      };
    },
    templateUrl: 'user-icon-template'
  };
}

// HACK: Totally disgusting workaround for inexplicable Chrome bug
// which seems specific to svgs and nearby elements.
// For certain kinds of css selectors, Chrome seems to fail to render
// the styles specified by the selector, even though the Chrome debugger
// recognizes that the selector applies to the given element and recognizes
// the style rules associated it.  Essentially, the Chrome debugger is
// showing that Chrome has recognized that it's supposed to render the styles,
// it just doesn't actually render them.  As soon as you toggle any style
// in the debugger, the Chrome then draws all elements on the page correctly.
// So if you poke it, it redraws correctly.
// So this hack simply attempts to poke the incorrectly-drawn elements so they
// will appear correct after a redraw.  This only affects, Chrome and not
// event Safari, so it seems not to be a WebKit bug.
//
// To use, just put tc-svg-hack=".selector, other-selector, etc"
// on a parent element that has rendering issues, where the selectors are
// children that should be redrawn.  On every changes to the classes
// of the parent element, the children will be redrawn.
function tcSvgHack($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      var selectors = attrs.tcSvgHack;
      scope.$watch(function() {
        return elem[0].className;
      }, function(newClasses, oldClasses) {
        var childrenToRedraw = elem.find(selectors);
        childrenToRedraw.hide();
        childrenToRedraw.show();
      }, true);      
    }
  };
}

HtmlInfowindow.prototype = new google.maps.OverlayView();

function HtmlInfowindow(marker, contentDiv) {
  this.marker = marker;
  this.contentDiv = contentDiv;
  this.innerDiv = $('<div>').css({
        'position': 'relative',
        'left': '-50%',
        'cursor': 'auto',
        'pointer-events': 'auto'
      }).append(contentDiv);
  this.div = $('<div>').css({
      'position': 'absolute',
      'pointer-events': 'none'
    }).append(this.innerDiv);

  this.div.on('mousedown click dblclick mousewheel DOMMouseScroll MozMousePixelScroll', function(event) {
    event.stopPropagation();
  });

  marker.map && this.setMap(marker.map);
}
// Override
HtmlInfowindow.prototype.onAdd = function() {
  this.getPanes().floatPane.appendChild(this.div[0]);
};

// Override
HtmlInfowindow.prototype.draw = function() {
  var overlayProjection = this.getProjection();
  var point = overlayProjection.fromLatLngToDivPixel(this.marker.position);
  this.div.css({
    'left': point.x,
    'top': point.y - this.contentDiv.height(),
    // This hack used to be needed, but may be obsolete now that max-width
    // is set on the infowindow.
    // 'width': this.contentDiv.width(),
    'z-index': Math.floor(point.y)
  });
  // Firefox doesn't compute the height properly the first time around.
  // Reset the top position using the height that is computed after the
  // width is set above.
  this.div.css('top', point.y - this.contentDiv.height());
  this.panMap();
};

// Override
HtmlInfowindow.prototype.onRemove = function() {
  this.div.remove();
};

HtmlInfowindow.prototype.panMap = function() {
  // if we go beyond map, pan map
  var map = this.getMap();
  var bounds = map.getBounds();
  if (!bounds) return;

  // The dimension of the infowindow
  var iwWidth = this.contentDiv.width();
  var iwHeight = this.contentDiv.height();

  // The offset position of the infowindow
  var iwOffsetX = this.div.position().left
    + this.innerDiv.position().left + this.contentDiv.position().left;
  var iwOffsetY = this.div.position().top
    + this.innerDiv.position().top + this.contentDiv.position().top;

  // Padding on the infowindow
  var padX = 40;
  var padY = 40;

  // The bounds of the map
  var mapWestLng = bounds.getSouthWest().lng();
  var mapEastLng = bounds.getNorthEast().lng();
  var mapNorthLat = bounds.getNorthEast().lat();
  var mapSouthLat = bounds.getSouthWest().lat();

  // The bounds of the infowindow
  var iwNorthWestLatLng = this.getProjection().fromDivPixelToLatLng(new google.maps.Point(
    iwOffsetX - padX, iwOffsetY - padY));
  var iwSouthEastLatLng = this.getProjection().fromDivPixelToLatLng(new google.maps.Point(
    iwOffsetX + iwWidth + padX, iwOffsetY + iwHeight + padY));
  var iwWestLng = iwNorthWestLatLng.lng();
  var iwEastLng = iwSouthEastLatLng.lng();
  var iwNorthLat = iwNorthWestLatLng.lat();
  var iwSouthLat = iwSouthEastLatLng.lat();

  // calculate center shift
  var shiftLng =
      (iwWestLng < mapWestLng ? mapWestLng - iwWestLng : 0) +
      (iwEastLng > mapEastLng ? mapEastLng - iwEastLng : 0);
  var shiftLat =
      (iwNorthLat > mapNorthLat ? mapNorthLat - iwNorthLat : 0) +
      (iwSouthLat < mapSouthLat ? mapSouthLat - iwSouthLat : 0);

  // The center of the map
  var center = map.getCenter();

  // The new map center
  var centerX = center.lng() - shiftLng;
  var centerY = center.lat() - shiftLat;

  // center the map to the new shifted center
  map.panTo(new google.maps.LatLng(centerY, centerX));
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

var MidPanelMode = {
  GUIDE: 1,
  SEARCH_PLACES: 2,
  WEB_SEARCH_PLACES: 3,
  TRAVEL_GUIDES: 4,
  CLIP_MY_OWN: 5
};

function PageStateModel(grouping, needsTutorial) {
  this.omniboxOpen = false;
  this.midPanelExpanded = false;
  this.midPanelMode = MidPanelMode.GUIDE;
  this.midPanelModeName = null;
  this.inNewTripPlanModal = false;
  this.grouping = grouping;
  this.selectedEntity = null;
  this.needsTutorial = needsTutorial;

  this.isMapFullScreen = function() {
    return this.inNewTripPlanModal;
  };

  this.inAddPlacePanel = function() {
    return this.midPanelMode != MidPanelMode.GUIDE;
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
  var grouping = initialState['sort'] == 'day' ? Grouping.DAY : Grouping.CATEGORY;
  var needsTutorial = initialState['needs_tutorial'];
  return new PageStateModel(grouping, needsTutorial);
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

function FilterModel() {
  this.selectedCategoryNames = {};
  this.selectedDayNumbers = {};
  this.emphasizedDayNumber = null;
  this.searchResultsEmphasized = false;

  this.isCategorySelected = function(category) {
    return this.selectedCategoryNames[category['name']] != false;
  };

  this.isCategoryNameSelected = function(name) {
    return this.selectedCategoryNames[name] != false;
  };

  this.isDaySelected = function(dayNumber) {
    return this.selectedDayNumbers[dayNumber] != false;
  };

  this.toggleCategory = function(category) {
    if (this.selectedCategoryNames[category['name']] == false) {
      this.selectedCategoryNames[category['name']] = true;
    } else {
      this.selectedCategoryNames[category['name']] = false;
    }
  };

  this.toggleDay = function(dayNumber) {
    if (this.selectedDayNumbers[dayNumber] == false) {
      this.selectedDayNumbers[dayNumber] = true;
    } else {
      this.selectedDayNumbers[dayNumber] = false;
    }
  };

  this.emphasisActive = function() {
    return this.emphasizedDayNumber != null || this.searchResultsEmphasized;
  };
}

function RootCtrl($scope, $http, $timeout, $modal, $tripPlanService, $tripPlanModel, $tripPlan, 
    $map, $pageStateModel, $filterModel, $searchResultState, $entityService, $allowEditing, $accountInfo) {
  var me = this;
  $scope.pageStateModel = $pageStateModel;
  $scope.searchResultState = $searchResultState;
  $scope.MidPanelMode = MidPanelMode;
  $scope.planModel = $tripPlanModel;
  $scope.filterModel = $filterModel;
  $scope.allowEditing = $allowEditing;
  $scope.refreshState = {
    paused: false
  };
  $scope.clipState = {
    url: null,
    clipping: false,
    statusCode: null
  };
  this.processItemsIntoGroups = function() {
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

  $scope.emphasizeDay = function(dayNumber) {
    $filterModel.emphasizedDayNumber = dayNumber;
  };

  $scope.deemphasizeDay = function() {
    $filterModel.emphasizedDayNumber = null;
  };

  $scope.resetMapState = function() {
    $scope.$broadcast('closeallinfowindows');
    $map.fitBounds($tripPlanModel.getMapBounds());
    $filterModel.emphasizedDayNumber = null;
  };

  $scope.openMidPanel = function() {
    $pageStateModel.midPanelExpanded = true;
  };

  $scope.closeMidPanel = function() {
    $pageStateModel.midPanelExpanded = false;
    $pageStateModel.midPanelMode = MidPanelMode.GUIDE;
    $scope.$broadcast('closeallinfowindows');
    $pageStateModel.selectedEntity = null;
    $scope.$broadcast('midpanelclosing');
  };

  $scope.openGuide = function() {
    $pageStateModel.midPanelMode = MidPanelMode.GUIDE;
    $scope.openMidPanel();
  };

  $scope.inTutorial = function() {
    return $pageStateModel.needsTutorial && $tripPlanModel.isEmpty();
  };

  $scope.updateMap = function() {
    google.maps.event.trigger($map, 'resize');
    $scope.$broadcast('mapresized');
  };

  google.maps.event.addListener($map, 'click', function() {
    $scope.$broadcast('closeallinfowindows');
    $pageStateModel.selectedEntity = null;
    $searchResultState.selectedIndex = null;
    $searchResultState.highlightedIndex = null;
    $scope.$apply();
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

  $scope.closeAddPlacePanel = function() {
    $scope.$broadcast('closeaddplacepanel');
  };

  $scope.$watch('searchResultState.savedResultIndices', function() {
    if (_.some($scope.searchResultState.savedResultIndices)
      && $scope.searchResultState.results
      && $scope.searchResultState.results.length == 1) {
      $timeout($scope.closeAddPlacePanel, 1000);
    }
  }, true);

  $scope.coverImageClicked = function() {
    $scope.pageStateModel.selectedEntity = null;
  };

  $scope.selectEntity = function(entityData) {
    $scope.pageStateModel.selectedEntity = entityData;
    $searchResultState.selectedIndex = null;
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

  $scope.openBulkClipModal = function(windowClass) {
    $modal.open({
      templateUrl: 'bulk-clip-modal-template',
      scope: $scope.$new(true),
      windowClass: windowClass
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

  $scope.openTripPlanEditor = function(windowClass) {
    $modal.open({
      templateUrl: 'trip-plan-settings-editor-template',
      scope: $scope.$new(true),
      windowClass: windowClass
    });
  };

  $scope.openSharingSettings = function(windowClass) {
    if (!$accountInfo['logged_in']) {
      alert('Please log in before sharing trip plans');
      return;
    }
    $modal.open({
      templateUrl: 'sharing-settings-editor-template',
      scope: $scope.$new(true),
      windowClass: windowClass
    });
  };

  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  $scope.$on('asktocloseallcontrols', function() {
    $scope.$broadcast('closeallcontrols');
  });

  $scope.$on('asktoopeninlineedit', function($event, entityId, inlineEditMode) {
    $scope.$broadcast('openinlineedit', entityId, inlineEditMode);
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
    $pageStateModel.inNewTripPlanModal = true;
    startTripPlanModal = $modal.open({
      templateUrl: 'start-new-trip-modal-template',
      scope: $.extend($scope.$new(true), {selectTripLocation: this.selectTripLocation}),
      backdrop: 'static',
      windowClass: 'start-new-trip-modal-window',
      keyboard: false
    });
    startTripPlanModal.result.finally(function() {
      $pageStateModel.inNewTripPlanModal = false;
    });
  }

  var initialBounds = $tripPlanModel.getMapBounds();
  if (initialBounds) {
    $map.fitBounds(initialBounds);
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
          $map.fitBounds($tripPlanModel.getMapBounds());
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
    zoom: 3,
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

function OrganizeMenuCtrl($scope, $tripPlanModel, $taxonomy) {
  $scope.typesExpanded = false;
  $scope.daysExpanded = false;

  $scope.categories = $taxonomy.allCategories();
  $scope.dayNumbers = _.range(1, $tripPlanModel.dayPlannerModel.numDays() + 1);

  $scope.suppress = function($event) {
    $event.stopPropagation();
    $event.preventDefault();
  };
}

function BulkClipCtrl($scope, $tripPlanModel, $allTripPlans, $entityService) {
  $scope.allEntities = angular.copy($tripPlanModel.entities());
  $scope.selectionState = {
    selectedTripPlan: $allTripPlans.length ? $allTripPlans[0] : null
  };

  $scope.selectAll = function() {
    $.each($scope.allEntities, function(i, entity) {
      entity.selected = true;
    });
  };

  $scope.selectNone = function() {
    $.each($scope.allEntities, function(i, entity) {
      entity.selected = false;
    });
  };

  $scope.selectedEntities = function() {
    return _.filter($scope.allEntities, function(entity) {
      return entity.selected;
    });
  };

  $scope.save = function() {
    var entities = $scope.selectedEntities();
    $.each(entities, function(i, entity) {
      entity['day'] = null;
      entity['day_position'] = null;
      entity['entity_id'] = null;
    });
    $scope.saving = true;
    $entityService.saveNewEntities(entities,
      $scope.selectionState.selectedTripPlan['trip_plan_id'])
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.saving = false;
          $scope.saved = true;
        }
      });
  };
}

function AccountDropdownCtrl($scope, $tripPlanService, $accountInfo,
    $tripPlan, $allTripPlans, $modal, $window) {
  $scope.accountInfo = $accountInfo;
  $scope.currentTripPlan = $tripPlan;
  $scope.allTripPlans = $allTripPlans;

  $scope.openLoginModal = function(windowClass) {
    var modal = $modal.open({
      templateUrl: 'login-modal-template',
      windowClass: windowClass,
      scope: $scope.$new(true)
    });
    $window['closeLoginModal'] = function() {
      modal.close();
      $window['closeLoginModal'] = null;
    };
  };

  $scope.loadTripPlan = function(tripPlanId) {
    location.href = '/trip_plan/' + tripPlanId;
  };

  $scope.createNewTripPlan = function() {
    if (!$scope.accountInfo['logged_in']) {
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


function SearchResultState() {
  this.selectedIndex = null;
  this.highlightedIndex = null;
  this.savedResultIndices = [];
  this.results = [];

  this.clear = function() {
    this.selectedIndex = null;
    this.savedResultIndices = [];
    this.results = [];
  };
}

function AddPlacePanelCtrl($scope, $searchResultState, $filterModel) {
  $scope.$on('midpanelclosing', function() {
    $searchResultState.clear();
    $filterModel.searchResultsEmphasized = false;
  });
}

function SearchPanelCtrl($scope, $tripPlanModel, $entityService,
    $pageStateModel, $searchResultState, $filterModel, $mapManager) {
  var me = this;
  $scope.queryState = {rawQuery: null};
  $scope.loadingData = false;
  $scope.searchResults = null;
  $scope.searchComplete = false;

  $scope.googlePlaceSelected = function(place) {
    $scope.loadingData = true;
    $scope.searchComplete = false;
    $scope.searchResults = null;
    $searchResultState.clear();
    if (place['reference']) {
      $entityService.googleplacetoentity(place['reference'])
        .success(me.processResponse);
    } else {
      $entityService.googletextsearchtoentities(place['name'],
        $tripPlanModel.tripPlanData['location_latlng'])
          .success(me.processResponse);
    }
  };

  this.processResponse = function(response) {
    if (response['entity']) {
      $scope.searchResults = [response['entity']]
    } else {
      $scope.searchResults = response['entities'] || [];
    }
    $scope.searchResultState.results = $scope.searchResults;
    $scope.loadingData = false;
    $scope.searchComplete = true;
    $mapManager.fitBoundsToEntities($scope.searchResults);
    $filterModel.searchResultsEmphasized = true;
    $filterModel.emphasizedDayNumber = null;
  };
}

function AddPlaceOptionsCtrl($scope, $pageStateModel,
    $searchResultState, $filterModel) {
  $scope.options = [
    {name: 'Search', mode: MidPanelMode.SEARCH_PLACES},
    {name: 'Browse the Web', mode: MidPanelMode.WEB_SEARCH_PLACES},
    {name: 'Browse Guides', mode: MidPanelMode.TRAVEL_GUIDES},
    {name: 'Clip My Own', mode: MidPanelMode.CLIP_MY_OWN}
  ];

  $scope.setOption = function(option) {
    if ($pageStateModel.midPanelMode != option.mode) {
      $scope.$emit('asktocloseallinfowindows');
      $pageStateModel.midPanelMode = option.mode;
      $pageStateModel.midPanelModeName = option.name;
      $pageStateModel.midPanelExpanded = true;
      $pageStateModel.selectedEntity = null;
      $searchResultState.clear();
      $filterModel.searchResultsEmphasized = false;
    }
  };
}

function WebSearchPanelCtrl($scope, $sampleSites, $tripPlanModel,
    $entityService, $searchResultState, $filterModel, $mapManager, $timeout) {
  var me = this;
  $scope.sampleSites = $sampleSites;
  $scope.selectedSite = $sampleSites[0];
  $scope.queryDropdownState = {isopen: false};
  $scope.customQueryState = {
    active: false,
    input: null,
    focus: 0
  };
  $scope.searching = false;
  $scope.searchComplete = false;
  $scope.searchResults = null;

  this.selectDefaultQuery = function() {
    var site = $scope.selectedSite;
    if (!_.isEmpty(site['sample_queries'])) {
      return site['sample_queries'][0];
    } else if (site['pseudo_query']) {
      return site['pseudo_query'];
    }
    return null;
  };

  $scope.selectedQuery = this.selectDefaultQuery();

  $scope.selectSite = function(site) {
    $scope.selectedSite = site;
    $scope.selectedQuery = me.selectDefaultQuery();
  }

  $scope.selectQuery = function(query) {
    $scope.selectedQuery = query;
  }

  $scope.openCustomQuery = function() {
    $scope.customQueryState.active = true;
    $scope.customQueryState.input = null;
    $timeout(function() {
      $scope.customQueryState.focus++;
    });
  };

  $scope.selectCustomQuery = function() {
    $scope.selectedQuery = $scope.customQueryState.input;
    $scope.customQueryState.active = false;
    $scope.customQueryState.input = null;
    $scope.queryDropdownState.isopen = false;
  };

  $scope.querySelectEnabled = function() {
    var site = $scope.selectedSite;
    return site['custom_queries_allowed'] || site['sample_queries'];
  };

  $scope.submitSearch = function() {
    $scope.searching = true;
    $scope.searchComplete = false;
    $searchResultState.clear();
    $entityService.sitesearchtoentities($scope.selectedSite['host'],
      $tripPlanModel.tripPlanData, $scope.selectedQuery)
      .success(function(response) {
        $scope.searching = false;
        $scope.searchComplete = true;
        $filterModel.searchResultsEmphasized = true;
        $filterModel.emphasizedDayNumber = null;
        $scope.searchResults = response['entities'];
        $mapManager.fitBoundsToEntities($scope.searchResults);
      });
  };
}

function TravelGuidesPanelCtrl($scope, $tripPlanModel, $tripPlanService,
    $mapManager, $filterModel) {
  $scope.locationName = $tripPlanModel.tripPlanData['location_name'];
  $scope.loading = true;
  $scope.tripPlans = null;
  $scope.selectedTripPlan = null;

  $tripPlanService.findTripPlans($tripPlanModel.tripPlanData['location_latlng'])
    .success(function(response) {
      $scope.loading = false;
      $scope.tripPlans = response['trip_plans'];
    });

  $scope.selectTripPlan = function(tripPlan) {
    $scope.selectedTripPlan = tripPlan;
    $mapManager.fitBoundsToEntities(tripPlan['entities']);
    $filterModel.searchResultsEmphasized = true;
  };

  $scope.backToListings = function() {
    $scope.selectedTripPlan = null;
  };
}

var SAMPLE_SUPPORTED_SITES = _.map([
  ['Yelp', 'http://www.yelp.com'],
  ['TripAdvisor', 'http://www.tripadvisor.com'],
  ['Foursquare', 'https://foursquare.com', 'https://foursquare.com/img/touch-icon-ipad-retina.png'],
  ['Hotels.com', 'http://www.hotels.com'],
  ['Airbnb', 'https://www.airbnb.com'],
  ['Booking.com', 'http://www.booking.com'],
  ['Hyatt', 'http://www.hyatt.com'],
  ['Starwood Hotels', 'http://www.starwoodhotels.com'],
  ['Hilton', 'http://www.hilton.com'],
  ['Lonely Planet', 'http://www.lonelyplanet.com'],
  ['Fodors', 'http://www.fodors.com'],
  ['Wikipedia', 'http://en.wikipedia.org']
], function(siteInfo) {
  return {
    name: siteInfo[0],
    url: siteInfo[1],
    iconUrl: siteInfo.length >= 3 ? siteInfo[2] : siteInfo[1] + '/favicon.ico'
  };
});

function ClipMyOwnPanelCtrl($scope, $entityService, $mapManager,
    $filterModel, $document, $timeout) {
  var me = this;
  $scope.state = {rawInput: null};
  $scope.loadingData = false;
  $scope.results = null;
  $scope.clipComplete = false;
  $scope.invalidUrl = false;
  $scope.learnMoreState = {expanded: false};

  $scope.sampleSupportedSites = SAMPLE_SUPPORTED_SITES;
  $scope.sampleSiteState = {
    hoverShow: false,
    clickShow: false,

    show: function() {
      return this.hoverShow || this.clickShow;
    }
  };

  $scope.openSampleSites = function() {
    $scope.sampleSiteState.clickShow = true;
    $timeout(function() {
      $document.on('click', closeSampleSites);
    });
  };

  var closeSampleSites = function() {
    $scope.sampleSiteState.clickShow = false;
    $document.off('click', null, closeSampleSites);
    $scope.$apply();
  };

  $scope.textPasted = function() {
    // Ugly hack to wrap this in a timeout; without it, the paste event
    // fires before the input has been populated with the pasted data.
    $timeout(function() {
      var input = $scope.state.rawInput;
      $scope.loadingData = true;
      $scope.clipComplete = false;
      $scope.results = null;
      $scope.invalidUrl = false;
      $scope.siteDomain = null;
      $entityService.urltoentities(input)
        .success(me.processResponse);
    });
  };

  this.processResponse = function(response) {
    $scope.results = response['entities'];
    $scope.loadingData = false;
    $scope.clipComplete = true;
    $scope.siteDomain = hostnameFromUrl($scope.state.rawInput);
    $mapManager.fitBoundsToEntities($scope.results);
    $filterModel.searchResultsEmphasized = true;
    $filterModel.emphasizedDayNumber = null;
  };

  $scope.urlToVisit = function() {
    var url = $scope.state.rawInput || '';
    if (url.indexOf('//') == 0) {
      url = 'http:' + url;
    }
    if (url.indexOf('http') != 0) {
      url = 'http://' + url;
    }
    return url;
  };
}

function EntitySearchResultCtrl($scope, $map, $templateToStringRenderer,
    $tripPlanModel, $pageStateModel, $entityService, $dataRefreshManager) {
  var me = this;
  $scope.ed = $scope.entityData;
  $scope.em = new EntityModel($scope.ed);
  $scope.im = new ItemModel($scope.ed);

  $scope.map = $map;
  $scope.position = $scope.em.gmapsLatLng();
  $scope.markerState = {
    marker: null
  };
  var infowindow = null;

  this.createInfowindow = function() {
    var scope = $scope.$new();
    var contentDiv = $templateToStringRenderer.render(
      'results-infowindow-template', scope);
    infowindow = new HtmlInfowindow($scope.markerState.marker, contentDiv);
  };

  this.destroyInfowindow = function() {
    infowindow && infowindow.setMap(null);
    infowindow = null;
  };

  $scope.$on('closeallinfowindows', function() {
    me.destroyInfowindow();
  });

  $scope.$on('$destroy', function() {
    me.destroyInfowindow();
  });

  $scope.markerClicked = function($event) {
    $scope.selectResult();
    $event.stopPropagation();
  };

  $scope.isSelected = function() {
    return $scope.searchResultState.selectedIndex == $scope.index ||
      $scope.searchResultState.highlightedIndex == $scope.index;
  };

  $scope.selectResult = function() {
    $scope.searchResultState.selectedIndex = $scope.index;
    $scope.searchResultState.highlightedIndex = null;
    $pageStateModel.selectedEntity = null;
    if (!infowindow) {
      $scope.$emit('asktocloseallinfowindows');
      me.createInfowindow();
    }
  };

  $scope.highlightResult = function() {
    $scope.searchResultState.highlightedIndex = $scope.index;
  };

  $scope.saveResult = function() {
    $entityService.saveNewEntity($scope.ed, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.addNewEntities(response['entities']);
          $pageStateModel.selectedEntity = response['entities'][0];
          $scope.searchResultState.savedResultIndices[$scope.index] = true;
          me.destroyInfowindow();
          $scope.$emit('redrawgroupings');
        }
      });
  };

  $scope.resultLetter = function() {
    return String.fromCharCode(65 + $scope.index);
  };
}

function EntityListingCtrl($scope) {
  $scope.ed = $scope.entityData;
  $scope.im = new ItemModel($scope.ed);
}

function tcEntitySearchResult() {
  return {
    restrict: 'AE',
    scope: {
      entityData: '=',
      searchResultState: '=',
      index: '='
    },
    templateUrl: 'one-entity-search-result-template'
  };
}

function tcEntityListing() {
  return {
    restrict: 'AE',
    scope: {
      entityData: '=',
      isSelected: '&',
      onSelect: '&',
      onMouseenter: '&',
      onMouseleave: '&',
      shouldShowDay: '@'
    },
    templateUrl: 'one-entity-listing-template',
    controller: EntityListingCtrl
  };
}


function EditPlaceCtrl($scope, $tripPlanModel, $taxonomy,
    $entityService, $dataRefreshManager) {
  var me = this;
  $scope.allEntities = $tripPlanModel.entities();
  $scope.selectedEntity = $scope.ed;
  $scope.locationBounds = $tripPlanModel.tripPlanData['location_bounds'];
  $scope.selectedPhoto = {index: null};
  $scope.mapState = {map: null};

  $scope.categories = $taxonomy.allCategories();
  $scope.getSubCategories = function(categoryId) {
    return $taxonomy.getSubCategoriesForCategory(categoryId);
  };

  $scope.markerDragged = function($position) {
    var entityData = $scope.ed;
    if (_.isEmpty(entityData['latlng'])) {
      entityData['latlng'] = {};
    }
    entityData['latlng']['lat'] = $position.lat();
    entityData['latlng']['lng'] = $position.lng();
    entityData['address_precision'] = 'Precise';
  };

  $scope.iconTemplateName = function() {
    if ($scope.ed['sub_category'] && $scope.ed['sub_category']['sub_category_id']) {
      return $scope.ed['sub_category']['name'] + '-icon-template';
    }
    if ($scope.ed['category'] && $scope.ed['category']['category_id']) {
      return $scope.ed['category']['name'] + '-icon-template';
    }
    return null;
  };

  this.findMapCenter = function() {
    return !_.isEmpty($scope.ed['latlng'])
      ? gmapsLatLngFromJson($scope.ed['latlng'])
      : new google.maps.LatLng(0, 0);
  }

  var mapCenter = this.findMapCenter();
  $scope.mapOptions = {
    center: mapCenter,
    zoom: !_.isEmpty($scope.ed['latlng']) ? 15 : 2,
    panControl: false,
    scaleControl: false,
    scrollwheel: false,
    streetViewControl: false,
    mapTypeControl: false
  };
  $scope.markerState = {
    marker: null,
    position: mapCenter  
  };

  $scope.setupMap = function($map) {
    $scope.markerState.marker.setMap($map);
  };

  $scope.addressChanged = function(place) {
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
      $scope.mapState.map.setCenter(location);
      $scope.markerState.position = location;
      if (place['geometry']['viewport']) {
        $scope.map.fitBounds(place['geometry']['viewport']);
      }
    }
  }

  $scope.categoryChanged = function() {
    $scope.ed['sub_category'] = $taxonomy.getSubCategoriesForCategory(
      $scope.ed['category']['category_id'])[0];
  };

  $scope.setPhotoAsPrimary = function() {
    var urls = $scope.ed['photo_urls'];
    var url = urls.splice($scope.selectedPhoto.index, 1)[0];
    urls.splice(0, 0, url);
    $scope.selectedPhoto.index = 0;
  };

  $scope.deletePhoto = function() {
    $scope.ed['photo_urls'].splice($scope.selectedPhoto.index, 1);
    if ($scope.selectedPhoto.index > 0
      && $scope.selectedPhoto.index > ($scope.ed['photo_urls'].length - 1)) {
      $scope.selectedPhoto.index--;
    }
  };

  $scope.selectedEntityChanged = function() {
    $scope.ed = angular.copy($scope.selectedEntity);
    var mapCenter = me.findMapCenter();
    $scope.map.setCenter(mapCenter);
    marker && marker.setMap(null);
    marker = me.createMarker(mapCenter, $scope.map);
    $scope.selectedPhotoIndex = null;
  };

  $scope.saveEntity = function() {
    $entityService.editEntity($scope.ed, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $dataRefreshManager.forceRefresh();
          $scope.$close();
        }
      })
      .error(function() {
        alert('Failed to save, please try again.');
      });
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

function TripPlanSettingsEditorCtrl($scope, $tripPlanModel, $tripPlanService,
    $timeout, $document) {
  $scope.tpd = angular.copy($tripPlanModel.tripPlanData);
  $scope.editingImage = !$scope.tpd['cover_image_url'];
  $scope.coverImgDragActive = false;
  $scope.coverImgUrlInput = {text:''};

  $scope.changeImage = function() {
    $scope.editingImage = true;
  };

  $scope.removeImage = function() {
    $scope.tpd['cover_image_url'] = '';
    $scope.editingImage = true;
  };

  $scope.coverImgDragenter = function($event) {
    $scope.coverImgDragActive = true;
  };

  $scope.coverImgUrlDropped = function($event) {
    var imgUrl = $event.originalEvent.dataTransfer.getData('text/uri-list');
    if (imgUrl) {
      $scope.tpd['cover_image_url'] = imgUrl;
    } else {
      alert("Couldn't recognize this image.")
    }
    $event.stopPropagation();
    $event.preventDefault();
    $scope.coverImgDragActive = false;
    $scope.editingImage = false;
  };

  var pasteActive = false;

  $scope.coverImgUrlPasted = function() {
    pasteActive = true;
    $timeout(function() {
      $scope.tpd['cover_image_url'] = $scope.coverImgUrlInput.text;
      $scope.coverImgUrlInput.text = '';
      pasteActive = false;
      $scope.editingImage = false;
    });
  };

  $scope.coverImgUrlChanged = function() {
    if (!pasteActive) {
      $scope.coverImgUrlInput.text = '';
    }
  };

  $scope.saveSettings = function() {
    $tripPlanService.editTripPlan($scope.tpd)
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateTripPlan(response['trip_plans'][0]);
          $document[0].title = response['trip_plans'][0]['name'];
          $scope.$close();
        }
      })
      .error(function() {
        alert('Error saving trip plan, please try again.');
      });
  };
}

function SharingSettingsCtrl($scope, $tripPlanModel, $accountInfo, $tripPlanService, $location) {
  $scope.formState = {email: null};
  $scope.accountInfo = $accountInfo;
  $scope.creator = $tripPlanModel.tripPlanData['user'];
  $scope.isCreator = $accountInfo['user']['public_id'] == $scope.creator['public_id'];
  $scope.shareUrl = 'https://' + $location.host()  + '/trip_plan/' + $tripPlanModel.tripPlanId();

  $scope.editors = function() {
    return $tripPlanModel.tripPlanData['editors'] || [];
  };

  $scope.inviteeEmails = function() {
    return $tripPlanModel.tripPlanData['invitee_emails'] || [];
  };

  $scope.hasCollaborators = function() {
    return $scope.editors().length || $scope.inviteeEmails().length;
  };

  $scope.addCollaborator = function() {
    var email = $scope.formState.email;
    if (!email) {
      return;
    }
    $tripPlanService.inviteCollaborator($tripPlanModel.tripPlanId(), email)
      .success(function(response) {
        $scope.handleMutateResponse(response);
        $scope.formState.email = null;
      });
  };

  $scope.removeEditor = function(editor) {
    $tripPlanService.removeEditor($tripPlanModel.tripPlanId(), editor['public_id'])
      .success($scope.handleMutateResponse);
  };

  $scope.removeInvitee = function(email) {
    $tripPlanService.removeInvitee($tripPlanModel.tripPlanId(), email)
      .success($scope.handleMutateResponse);
  };

  $scope.handleMutateResponse = function(response) {
    if (response['response_code'] == ResponseCode.SUCCESS) {
      $tripPlanModel.updateCollaborators(response['collaborators'][0]);
      $tripPlanModel.updateLastModified(response['last_modified']);
    };
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
    if (this.data['sub_category'] && this.data['sub_category']['name'] != 'none') {
      return this.data['sub_category']['display_name'];
    } else if (this.data['category'] && this.data['category']['name'] != 'none') {
      return this.data['category']['display_name'];
    }
    return '';
  };

  this.hasPhotos = function() {
    return this.data['photo_urls'] && this.data['photo_urls'].length;
  };

  this.latlngString = function() {
    return [this.data['latlng']['lat'], this.data['latlng']['lng']].join(',')
  };

  this.staticMiniMapUrl = function(opt_referenceLatlng) {
    var parts = ['//maps.googleapis.com/maps/api/staticmap?sensor=false&size=100x100',
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

  this.insertNewItem = function(item) {
    if (item.day()) {
      var position = item.position() || this.dayModelForDay(item.day()).getItems().length;
      this.organizeItem(item);
    } else {
      this.unorderedItems.push(item);
    }
  };

  // Doesn't work for notes yet.
  this.removeItem = function(item) {
    if (item.day()) {
      this.dayModelForDay(item.day()).removeItem(item);
    } else {
      for (var i = 0; i < this.unorderedItems.length; i++) {
        if (this.unorderedItems[i]['entity_id'] == item.data['entity_id']) {
          this.unorderedItems.splice(i, 1);
          break;
        }
      }
    }
  };

  // Initialization
  this.reset(entityItems, noteItems);

  this.numDays = function() {
    return this.dayModels[this.dayModels.length - 1].dayNumber;
  };

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

function FlashedMessagesCtrl($scope, $flashedMessages) {
  $scope.messages = $flashedMessages;

  $scope.hasMessages = function() {
    return !_.isEmpty($scope.messages);
  };

  $scope.dismiss = function(index) {
    $scope.messages.splice(index, 1);
  };
}

function MapManager($map) {
  this.fitBoundsToEntities = function(entities) {
    if (_.isEmpty(entities)) {
      return;
    }
    if (entities.length == 1) {
      if (!_.isEmpty(entities[0]['latlng'])) {
        $map.setCenter(gmapsLatLngFromJson(entities[0]['latlng']));
      }
      return;
    }
    var bounds = new google.maps.LatLngBounds();
    $.each(entities, function(i, entity) {
      if (!_.isEmpty(entity['latlng'])) {
        bounds.extend(gmapsLatLngFromJson(entity['latlng']));
      }
    });
    if (!bounds.isEmpty()) {
      $map.fitBounds(bounds);
    }
  };
}

// Directives

function tcScrollToSelector($interpolate) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var elem = $(element);
      scope.$watch(attrs.scrollOnChangesTo, function(value) {
        if (value != undefined || value != null) {
          var selector = $interpolate(attrs.scrollDestSelector)(scope);
          var destOffset = $(selector).offset();
          if (!destOffset) {
            // The element could be hidden right now.
            return;
          }
          var oldScrollTop = elem.scrollTop();
          var newScrollTop = oldScrollTop + destOffset.top - elem.offset().top;
          if (attrs.skipScrollWhenInView && newScrollTop >= oldScrollTop && newScrollTop < (oldScrollTop + elem.height())) {
            return;
          }
          elem.animate({scrollTop: newScrollTop}, 500);
        }
      });
    }
  };
}

function tcIcon() {
  return {
    restrict: 'AEC',
    templateUrl: function(element, attrs) {
      return attrs.tcIcon + '-icon-template';
    },
    link: function(scope, element, attrs) {
      $(element).addClass('tc-icon');
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
      onSelectPlace: '&',
      hidePrompt: '=',
      placeholder: '='
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

function tcLockAfterScroll($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var scrollParent = $(attrs.scrollParent);
      var elem = $(element);
      var spread = elem.offset().top - scrollParent.offset().top;
      var classWhenFixed = attrs.classWhenFixed;
      var parentClassWhenFixed = attrs.parentClassWhenFixed;
      if (attrs.recomputeSpreadOn) {
        scope.$watch(attrs.recomputeSpreadOn, function() {
          $timeout(function() {
            spread = elem.offset().top - scrollParent.offset().top;
          });
        });
      }
      var elemHeight = elem.outerHeight();
      var spacer = $('<div>').height(elemHeight);
      scrollParent.on('scroll', function() {
        if (scrollParent.scrollTop() >= spread) {
          if (classWhenFixed) {
            elem.addClass(classWhenFixed);          
          }
          if (parentClassWhenFixed) {
            scrollParent.addClass(parentClassWhenFixed);
          }
          elem.after(spacer);
        } else {
          if (classWhenFixed) {
            elem.removeClass(classWhenFixed);          
          }
          if (parentClassWhenFixed) {
            scrollParent.removeClass(parentClassWhenFixed);
          }
          spacer.remove();
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

function tcAnimateOnBool($animate) {
  return {
    restrict: 'A',
    scope: {
      tcAnimateOnBool: '=',
      afterComplete: '&'
    },
    link: function(scope, element, attrs) {
      scope.$watch('tcAnimateOnBool', function(condition, oldCondition) {
        if (condition === oldCondition) {
          return;
        }
        if (condition) {
          $animate.addClass(element, attrs.classWhenTrue, scope.afterComplete);
        } else {
          $animate.removeClass(element, attrs.classWhenTrue, scope.afterComplete);
        }
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

function tcImageCarousel() {
  return {
    restrict: 'AEC',
    templateUrl: 'image-carousel-template',
    scope: {
      urls: '=',
      onChange: '&',
      currentIndex: '='
    },
    controller: function($scope) {
      var me = this;
      // We do a hacky manual data-binding thing here because we want
      // the current-index parameter to be optional, as most carousel
      // uses don't need it.
      $scope.currentIndex_ = 0;

      $scope.$watch('urls', function() {
        $scope.currentIndex_ = 0;
        me.notifyChange();
      });

      $scope.$watch('currentIndex', function(index) {
        if (index !== undefined) {
          $scope.currentIndex_ = index;
        }
      });

      $scope.currentImgUrl = function() {
        return $scope.urls[$scope.currentIndex_];
      };

      $scope.hasPrevImg = function() {
        return $scope.currentIndex_ > 0;
      };

      $scope.hasNextImg = function() {
        return $scope.currentIndex_ < ($scope.urls.length - 1);
      };

      $scope.nextImg = function() {
        if ($scope.hasNextImg()) {
          $scope.currentIndex_++;
          me.notifyChange();
        }
      };

      $scope.prevImg = function() {
        if ($scope.hasPrevImg()) {
          $scope.currentIndex_--;
          me.notifyChange();
        }
      };

      this.notifyChange = function() {
        if ($scope.currentIndex !== undefined) {
          $scope.currentIndex = $scope.currentIndex_;
        }
        $scope.onChange && $scope.onChange({$index: $scope.currentIndex_, $url: $scope.currentImgUrl()});
      };
    }
  };
}

function tcIncludeAndReplace() {
  return {
    restrict: 'A',
    replace: true,
    templateUrl: function(element, attrs) {
      return attrs.tcIncludeAndReplace;
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

function tcGoogleMap($timeout) {
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
      $timeout(function() {
        var oldCenter = map.getCenter();
        google.maps.event.trigger(map, 'resize');
        map.setCenter(oldCenter);
        scope.afterCreation({$map: map});
      });
    }
  };
}

function tcTransitionend($parse) {
  return {
    restrict: 'AC',
    link: function(scope, element, attrs) {
      var onEventFn = $parse(attrs.tcTransitionend);
      element.on('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function(event) {
        scope.$apply(function() {
          onEventFn(scope, {$event: event});
        });
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
  .directive('tcImageCarousel', tcImageCarousel)
  .directive('tcScrollToSelector', tcScrollToSelector)
  .directive('tcScrollSignal', tcScrollSignal)
  .directive('tcAnimateOnBool', tcAnimateOnBool)
  .directive('tcTransitionend', tcTransitionend)
  .directive('tcIncludeAndReplace', tcIncludeAndReplace)
  .directive('tcIcon', tcIcon)
  .directive('tcSvgHack', tcSvgHack)
  .directive('tcTripPlanSelectDropdown', tcTripPlanSelectDropdown);

function makeFilter(fn) {
  return function() {
    return fn;
  };
}

angular.module('filtersModule', [])
  .filter('hostname', makeFilter(hostnameFromUrl))
  .filter('hostNoSuffix', makeFilter(hostNoSuffix))
  .filter('hostToIcon', makeFilter(hostToIcon));

window['initApp'] = function(tripPlan, entities, notes, allTripPlans,
    accountInfo, datatypeValues, allowEditing, sampleSites, initialState, flashedMessages) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanModel', new TripPlanModel(tripPlan, entities, notes))
    .value('$allTripPlans', allTripPlans)
    .value('$pageStateModel', PageStateModel.fromInitialState(initialState))
    .value('$filterModel', new FilterModel())
    .value('$searchResultState', new SearchResultState())
    .value('$taxonomy', new TaxonomyTree(datatypeValues['categories'], datatypeValues['sub_categories']))
    .value('$accountInfo', accountInfo)
    .value('$allowEditing', allowEditing)
    .value('$sampleSites', sampleSites)
    .value('$flashedMessages', flashedMessages);

  angular.module('mapModule', [])
    .value('$map', createMap(tripPlan));

  angular.module('appModule', ['mapModule', 'initialDataModule', 
      'servicesModule', 'directivesModule', 'filtersModule',
      'ui.bootstrap', 'ngSanitize', 'ngAnimate'],
      interpolator)
    .controller('RootCtrl', RootCtrl)
    .controller('OrganizeMenuCtrl', OrganizeMenuCtrl)
    .controller('BulkClipCtrl', BulkClipCtrl)
    .controller('AccountDropdownCtrl', AccountDropdownCtrl)
    .controller('ItemGroupCtrl', ItemGroupCtrl)
    .controller('GuideviewItemGroupCtrl', GuideviewItemGroupCtrl)
    .controller('EntityCtrl', EntityCtrl)
    .controller('GuideviewEntityCtrl', GuideviewEntityCtrl)
    .controller('InfowindowCtrl', InfowindowCtrl)
    .controller('NoteCtrl', NoteCtrl)
    .controller('ReclipConfirmationCtrl', ReclipConfirmationCtrl)
    .controller('CarouselCtrl', CarouselCtrl)
    .controller('AddPlaceOptionsCtrl', AddPlaceOptionsCtrl)
    .controller('AddPlacePanelCtrl', AddPlacePanelCtrl)
    .controller('SearchPanelCtrl', SearchPanelCtrl)
    .controller('WebSearchPanelCtrl', WebSearchPanelCtrl)
    .controller('TravelGuidesPanelCtrl', TravelGuidesPanelCtrl)
    .controller('ClipMyOwnPanelCtrl', ClipMyOwnPanelCtrl)
    .controller('EditPlaceCtrl', EditPlaceCtrl)
    .controller('EditImagesCtrl', EditImagesCtrl)
    .controller('TripPlanSettingsEditorCtrl', TripPlanSettingsEditorCtrl)
    .controller('SharingSettingsCtrl', SharingSettingsCtrl)
    .controller('DayPlannerCtrl', DayPlannerCtrl)
    .controller('DayPlannerOneDayCtrl', DayPlannerOneDayCtrl)
    .controller('GmapsImporterCtrl', GmapsImporterCtrl)
    .controller('FlashedMessagesCtrl', FlashedMessagesCtrl)
    .directive('tcItemDropTarget', tcItemDropTarget)
    .directive('tcDraggableEntity', tcDraggableEntity)
    .directive('tcStartNewTripInput', tcStartNewTripInput)
    .directive('tcCoverScroll', tcCoverScroll)
    .directive('tcDaySelectDropdown', tcDaySelectDropdown)
    .directive('tcEntitySearchResult', tcEntitySearchResult)
    .directive('tcEntityListing', tcEntityListing)
    .directive('tcEntityMarker', tcEntityMarker)
    .directive('tcEntityIcon', tcEntityIcon)
    .directive('tcSearchResultMarker', tcSearchResultMarker)
    .directive('tcSearchResultIcon', tcSearchResultIcon)
    .directive('tcUserIcon', tcUserIcon)
    .service('$templateToStringRenderer', TemplateToStringRenderer)
    .service('$dataRefreshManager', DataRefreshManager)
    .service('$pagePositionManager', PagePositionManager)
    .service('$mapManager', MapManager)
    .filter('creatorDisplayName', makeFilter(creatorDisplayName));

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
