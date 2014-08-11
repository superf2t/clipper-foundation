function hostnameFromUrl(url) {
  url = urlWithProtocol(url);
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

function urlWithProtocol(url) {
  if (url.indexOf('//') == 0) {
    url = 'http:' + url;
  }
  if (url.indexOf('http') != 0) {
    url = 'http://' + url;
  }; 
  return url;
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

var SUMMARY_PANEL_WIDTH_PERCENT = 0.15;

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

  this.hasOpeningHours = function() {
    return this.data['opening_hours']
    && (this.data['opening_hours']['as_string']
      || this.data['opening_hours']['source_text']);
  };

  this.openingHoursStr = function() {
    if (!this.data['opening_hours']) {
      return null;
    }
    return this.data['opening_hours']['as_string']
    || this.data['opening_hours']['source_text'];
  };

  this.hasComments = function() {
    return this.data['comments'] && this.data['comments'].length;
  };

  this.numComments = function() {
    if (this.data['comments']) {
      return this.data['comments'].length;
    }
    return 0;
  };

  this.hasTags = function() {
    return !_.isEmpty(this.data['tags']);
  };

  this.hasReputationInfo = function() {
    return this.data['rating'] || this.data['review_count']
  };

  this.hasPhotos = function() {
    return this.data['photo_urls'] && this.data['photo_urls'].length;
  };

  this.gmapsLatLng = function() {
    if (!this.data['latlng']) {
      return null;
    }
    return new google.maps.LatLng(this.data['latlng']['lat'], this.data['latlng']['lng']);
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

  this.iconTemplateName = function() {
    if (this.hasSubCategory()) {
      return this.data['sub_category']['name'] + '-icon-template';
    }
    if (this.hasCategory()) {
      return this.data['category']['name'] + '-icon-template';
    }
    return null;
  };
}

function TripPlanModel(tripPlanData, entityDatas) {
  var me = this;

  this.resetEntities = function(entities) {
    this.entitiesById = dictByAttr(entities, 'entity_id');
    this.entityDatas = entities || [];
  };

  this.tripPlanData = tripPlanData;
  this.resetEntities(entityDatas);

  this.entities = function() {
    return this.entityDatas;
  };

  this.hasEntities = function() {
    return this.entityDatas && this.entityDatas.length;
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

  this.hasTags = function() {
    return !_.isEmpty(this.tripPlanData['tags']);
  };

  this.hasSource = function() {
    return !!this.tripPlanData['source_url'];
  };

  this.isGuide = function() {
    return this.tripPlanData['trip_plan_type'] == 'GUIDE';
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
  };

  this.addNewEntities = function(entityDatas) {
    this.entityDatas.push.apply(this.entityDatas, entityDatas);
    $.each(entityDatas, function(i, entityData) {
      me.entitiesById[entityData['entity_id']] = entityData;
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
}

function ActiveTripPlanStateModel(tripPlan, numEntities) {
  this.tripPlan = tripPlan;
  this.numEntities = numEntities || 0;
  this.lastClippedEntity = null;
  this.savedEntityIds = {};

  this.isSaved = function(entity) {
    return !!this.savedEntityIds[entity['entity_id']];
  };
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

var InlineEditMode = {
  COMMENTS: 1,
  DESCRIPTION: 2,
  DIRECTIONS: 3,
  TAGS: 4
};

function EntitySummaryCtrl($scope, $tripPlanModel, $entityEditingService,
    $entityClippingService, $entityCtrlProxy, $entityDragStateModel,
    $filterModel, $timeout) {
  var me = this;
  $scope.ed = $scope.entity;
  $scope.em = new EntityModel($scope.ed);
  $scope.InlineEditMode = InlineEditMode;
  $scope.isDraggable = true;

  $scope.controlState = {
    open: false,
    showSecondaryControls: false
  };

  $scope.selectEntity = function() {
    $entityCtrlProxy.selectEntity($scope.ed);
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

  $scope.openEditPlaceModal = function() {
    $entityEditingService.openEditPlaceModal($scope.ed);
  };

  $scope.deleteEntity = function() {
    $entityEditingService.deleteEntity($scope.ed);
  };

  $scope.saveStarState = function(starred) {
    $entityEditingService.saveStarState($scope.ed, starred);
  };

  $scope.openInlineEdit = function(inlineEditMode) {
    $entityCtrlProxy.openInlineEdit($scope.ed, inlineEditMode);
  };

  $scope.isBeingDragged = function() {
    return $entityDragStateModel.isBeingDragged($scope.ed);
  };

  $scope.isActive = function() {
    return !$filterModel.attributeFilteringActive()
      || $filterModel.hasActiveAttributeFilter($scope.ed);
  };

  $scope.$watch(function() {
    return $filterModel.attributeFilteringActive();
  }, function(filteringActive) {
    $scope.isDraggable = !filteringActive;
  });

  $scope.filterToCategory = function($event) {
    $filterModel.setActiveCategory($scope.ed['category']);
    $event.stopPropagation();
  };
}

function EntityOrderingService($entityDragStateModel, $tripPlanModel, $entityService) {
  this.onDrop = function() {
    if (!$entityDragStateModel.orderingChanged()) {
      return;
    }

    var oldIndex = $entityDragStateModel.originalOrderingMap[
      $entityDragStateModel.draggedEntity['entity_id']];
    var newIndex = $entityDragStateModel.orderingMap[
      $entityDragStateModel.draggedEntity['entity_id']];
    var entity = $tripPlanModel.entityDatas.splice(oldIndex, 1)[0];
    $tripPlanModel.entityDatas.splice(newIndex, 0, entity);

    $entityService.orderentities($tripPlanModel.tripPlanId(), $entityDragStateModel.orderedEntityIds)
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $entityDragStateModel.createOrdering(response['entities']);
        }
      });
  };

  this.dragEnded = function() {
    $entityDragStateModel.dragEnded();
  };
}

function tcTrackEntityDragState($entityDragStateModel, $entityOrderingService) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.$watch(function() {
        return $entityDragStateModel.orderingMap;
      }, function(newOrdering, oldOrdering) {
        if ($entityDragStateModel.shiftHeight()
            && !_.isEmpty(newOrdering) && !_.isEmpty(oldOrdering)) {
          scope.$broadcast('entity-ordering-changed', newOrdering, oldOrdering);
        }
      });

      scope.$watch(function() {
        return $entityDragStateModel.draggedEntity;
      }, function(draggedEntity) {
        if (!draggedEntity) {
          scope.$broadcast('entity-dragging-ended');
        }
      });


      element.on('dragover', function(event) {
        if ($entityDragStateModel.draggingActive()) {
          event.preventDefault();
        }
      });

      element.on('drop', function(event) {
        if ($entityDragStateModel.draggingActive()) {
          $entityOrderingService.onDrop();
          event.preventDefault();
          scope.$apply();
        }
      });
    }
  };
}

function tcDraggableEntitySummary($timeout, $rootScope, $entityOrderingService,
    $entityDragStateModel, $eventTracker) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var ed = scope.ed;
      var cachedHalfHeight = null;
      element.on('dragstart', function(event) {
        $timeout(function() {
          // Do this in a timeout so that settings visiblity:hidden
          // on the dragged element doesn't cause the drag ghost image
          // to also go invisible.
          $entityDragStateModel.setDraggedEntity(ed, element);
        });
        $eventTracker.track({name: 'entity-dragged', location: 'summary-panel', value: ed['entity_id']});
      }).on('dragend', function() {
        $entityOrderingService.dragEnded();
        scope.$apply();
      }).on('dragover', function(event) {
        if (!cachedHalfHeight) {
          cachedHalfHeight = element.height() / 2;
        }
        var mouseY = event.originalEvent.clientY;
        var midY = element.offset().top + cachedHalfHeight;
        if ((mouseY > midY
            && $entityDragStateModel.isOrderedAfterDraggedEntity(ed))
          || (mouseY < midY
            && $entityDragStateModel.isOrderedBeforeDraggedEntity(ed))) {
          $entityDragStateModel.swapPositions(ed);
          scope.$apply();
        }
      }).on('dragleave', function() {
        $entityDragStateModel.activeComparisonEntity = null;
        scope.$apply();
      });

      scope.$on('entity-dragging-ended', function() {
        element.css('top', '');
        cachedHalfHeight = null;
      });

      scope.$on('entity-ordering-changed', function(event, newOrdering, oldOrdering) {
        if ($entityDragStateModel.isBeingDragged(ed)) {
          return;
        }
        var oldIndex = oldOrdering[ed['entity_id']];
        var newIndex = newOrdering[ed['entity_id']];
        var shiftHeight = $entityDragStateModel.shiftHeight();
        if (newIndex > oldIndex) {
          if (element.css('top') == 'auto') {
            element.css('top', shiftHeight);
          } else {
            element.css('top', '');
          }
        } else if (newIndex < oldIndex) {
          if (element.css('top') == 'auto') {
            element.css('top', -shiftHeight);
          } else {
            element.css('top', '');
          }
        }
      });
    }
  };
}

var InfoTab = {
  ABOUT: 1,
  DETAILS: 2,
  COMMENTS: 3
};

function EntityDetailsCtrl($scope, $tripPlanModel, $activeTripPlanState,
    $pageStateModel, $filterModel, $searchResultState, $accountInfo, $map,
    $entityEditingService, $entityClippingService,
    $templateToStringRenderer, $sizeHelper, $eventTracker,
    $window, $timeout) {
  $scope.ed = $scope.entity;
  $scope.em = new EntityModel($scope.ed);
  $scope.accountInfo = $accountInfo;

  $scope.et = $eventTracker;
  this.getTrackingLocation = function() {
    var location = $scope.forResults ? 'entity-details/result' : 'entity-details';
    if ($scope.forGuide) {
      location = location + '/guide';
    }
    return location;
  };
  $scope.trackingLocation = this.getTrackingLocation();

  $scope.showAboutTab = function() {
    return $scope.isEditable || (
      $scope.ed['origin_trip_plan_name'] || $scope.ed['description']
      || !_.isEmpty($scope.ed['tags']));
  };

  $scope.infoTab = $scope.showAboutTab() ? InfoTab.ABOUT : InfoTab.DETAILS;
  $scope.InfoTab = InfoTab;

  $scope.inlineEditMode = null;
  $scope.InlineEditMode = InlineEditMode;

  $scope.directionsHelper = new DirectionsHelper($tripPlanModel.entities(), $window);

  $scope.newComment = {};
  $scope.editingComment = null;

  $scope.tagState = {rawInput: null};
  $scope.descriptionState = {rawInput: null};

  $scope.markerState = {
    map: $map,
    marker: null,
    position: $scope.em.gmapsLatLng(),
    infowindow: null,
    emphasized: null,
    deemphasized: null
  };

  $scope.selectInfoTab = function(infoTab) {
    $scope.infoTab = infoTab;
    $scope.inlineEditMode = null;
    $scope.directionsHelper.reset();
  };

  $scope.resultLetter = function() {
    return String.fromCharCode(65 + $scope.resultIndex);

  };

  $scope.showCommentsTab = function() {
    return $scope.isEditable || $scope.em.hasComments();
  };

  $scope.showTags = function() {
    return ($scope.em.hasTags() || $scope.isEditable)
      && $scope.inlineEditMode != InlineEditMode.TAGS;
  };

  $scope.showAddDescriptionPrompt = function() {
    return !$scope.ed['description'] && $scope.isEditable
      && $scope.inlineEditMode != InlineEditMode.DESCRIPTION;
  };

  $scope.isAlreadySaved = function() {
    if ($scope.forResults) {
      return $searchResultState.savedResultIndices[$scope.resultIndex];
    } else {
      return $activeTripPlanState.savedEntityIds[$scope.ed['entity_id']];
    }
  };

  $scope.clipEntity = function() {
    $entityClippingService.clipEntity($scope.ed, $scope.tripPlanId, $scope.resultIndex);
  };

  $scope.saveStarState = function(starred) {
    $entityEditingService.saveStarState($scope.ed, starred);
  };

  $scope.deleteEntity = function() {
    $entityEditingService.deleteEntity($scope.ed);
  };

  $scope.openEditPlaceModal = function() {
    $entityEditingService.openEditPlaceModal($scope.ed);
  };

  $scope.openDirections = function() {
    $scope.infoTab = InfoTab.DETAILS;
    $scope.inlineEditMode = InlineEditMode.DIRECTIONS;
  };

  $scope.closeDirections = function() {
    $scope.inlineEditMode = null;
    $scope.directionsHelper.reset();
  };

  $scope.openNewComment = function() {
    $scope.newComment = {
      'entity_id': $scope.ed['entity_id'],
      'text': null
    };
    $scope.infoTab = InfoTab.COMMENTS;
    $scope.inlineEditMode = InlineEditMode.COMMENTS;
  };

  $scope.saveNewComment = function() {
    $entityEditingService.saveNewComment($scope.newComment, function() {
      $scope.closeNewComment();
    });
  };

  $scope.closeNewComment = function() {
    $scope.newComment = {};
    $scope.inlineEditMode = null;
  };

  $scope.openCommentEdit = function(comment) {
    $scope.editingComment = angular.copy(comment);
    $scope.inlineEditMode = null;
  };

  $scope.closeCommentEdit = function() {
    $scope.editingComment = null;
  };

  $scope.saveCommentEdit = function() {
    $entityEditingService.saveCommentEdit($scope.editingComment, function() {
      $scope.closeCommentEdit();
    });
  };

  $scope.deleteComment = function(comment) {
    $entityEditingService.deleteComment(comment);
  };

  $scope.openTagsEditor = function() {
    $scope.tagState.rawInput = _.pluck($scope.ed['tags'], 'text').join(', ');
    $scope.inlineEditMode = InlineEditMode.TAGS;
    $scope.infoTab = InfoTab.ABOUT;
  };

  $scope.closeTagsEditor = function() {
    $scope.tagState.rawInput = null;
    $scope.inlineEditMode = null;
  };

  $scope.saveTags = function() {
    $entityEditingService.saveTags($scope.ed, $scope.tagState.rawInput, function() {
      $scope.closeTagsEditor();
    });
  };

  $scope.openDescriptionEditor = function() {
    $scope.descriptionState.rawInput = $scope.ed['description'];
    $scope.inlineEditMode = InlineEditMode.DESCRIPTION;
    $scope.infoTab = InfoTab.ABOUT;
  };

  $scope.saveDescription = function() {
    $entityEditingService.saveDescription(
      $scope.ed, $scope.descriptionState.rawInput, function() {
        $scope.closeDescriptionEditor();
      });
  };

  $scope.closeDescriptionEditor = function() {
    $scope.descriptionState.rawInput = null;
    $scope.inlineEditMode = null;
  };

  $scope.isActive = function() {
    return $scope.forResults
      || !$filterModel.attributeFilteringActive()
      || $filterModel.hasActiveAttributeFilter($scope.ed);
  };

  $scope.makeTagActive = function(tag) {
    $filterModel.setActiveTag(tag);
  };

  $scope.filterToCategory = function() {
    $filterModel.setActiveCategory($scope.ed['category']);
  };

  $scope.markerClicked = function($event) {
    if ($scope.forResults) {
      $scope.selectResult();
    } else {
      $scope.selectEntity();
    }
    $event.stopPropagation();
  };

  $scope.setMarkerState = function() {
    if (!$scope.markerState.marker) {
      return;
    }
    if ($filterModel.searchResultsEmphasized) {
      $scope.markerState.deemphasized = !$scope.forResults;
    } else {
      $scope.markerState.deemphasized = false;
    }
    if ($scope.forResults) {
      $scope.markerState.emphasized = $searchResultState.highlightedIndex == $scope.resultIndex;
    } else {
      $scope.markerState.emphasized = $filterModel.entityIsHighlighted($scope.ed['entity_id']);
      $scope.markerState.deemphasized = $filterModel.attributeFilteringActive()
        && !$filterModel.hasActiveAttributeFilter($scope.ed);
    }
  };

  $scope.highlightMarker = function() {
    if ($scope.forResults) {
      $searchResultState.highlightedIndex = $scope.resultIndex;
    } else {
      $filterModel.highlightedEntity = $scope.ed;
    }
  };

  $scope.selectEntity = function() {
    $pageStateModel.selectedEntity = $scope.ed;
    $searchResultState.selectedIndex = null;
    if (!$scope.markerState.infowindow) {
      $scope.$emit('asktocloseallinfowindows');
      if ($scope.em.hasLocation()) {
        $scope.createEntityInfowindow();
      }      
    }
  };

  $scope.selectResult = function() {
    $searchResultState.selectedIndex = $scope.resultIndex;
    $searchResultState.highlightedIndex = null;
    $pageStateModel.selectedEntity = null;
    if (!$scope.markerState.infowindow) {
      $scope.$emit('asktocloseallinfowindows');
      $scope.createResultsInfowindow();
    }
  };

  $scope.entityIsSelected = function() {
    if ($scope.forResults) {
      return $searchResultState.selectedIndex == $scope.resultIndex;
    } else {
      return $pageStateModel.entityIsSelected($scope.ed['entity_id']);
    }
  };

  $scope.resultAlreadySaved = function() {
    return $searchResultState.savedResultIndices[$scope.resultIndex];
  };

  $scope.createEntityInfowindow = function() {
    var scope = $scope.$new();
    var contentDiv = $templateToStringRenderer.render('infowindow-template', scope);
    var extraPadding = $pageStateModel.summaryPanelExpanded
      ? $sizeHelper.widthPercentToPixels(SUMMARY_PANEL_WIDTH_PERCENT)
      : 0;
    var overlay = new HtmlInfowindow($scope.markerState.marker, contentDiv, {
      'extraPaddingX': extraPadding
    });
    scope.onSizeChange = function() {
      overlay.draw();
    };
    $scope.markerState.infowindow = overlay;
  };

  $scope.createResultsInfowindow = function() {
    var scope = $scope.$new();
    var contentDiv = $templateToStringRenderer.render(
      'results-infowindow-template', scope);
    var extraPadding = $pageStateModel.summaryPanelExpanded
      ? $sizeHelper.widthPercentToPixels(SUMMARY_PANEL_WIDTH_PERCENT)
      : 0;
    $scope.markerState.infowindow = new HtmlInfowindow($scope.markerState.marker, contentDiv, {
      'extraPaddingX': extraPadding
    });
  };

  $scope.destroyInfowindow = function() {
    $scope.markerState.infowindow && $scope.markerState.infowindow.setMap(null);
    $scope.markerState.infowindow = null;
  };

  $scope.$on('closeallinfowindows', function() {
    $scope.destroyInfowindow();
  });

  $scope.$on('$destroy', function() {
    $scope.destroyInfowindow();
  });

  $scope.$on('entity-selected', function(event, entity) {
    if ($scope.ed['entity_id'] && entity['entity_id'] == $scope.ed['entity_id']) {
      $scope.selectEntity();
    }
  });

  $scope.$on('open-inline-edit', function(event, entity, inlineEditMode) {
    if ($scope.ed['entity_id'] && entity['entity_id'] == $scope.ed['entity_id']) {
      $scope.selectEntity();
      $pageStateModel.infoPanelExpanded = true;
      $pageStateModel.infoPanelMode = InfoPanelMode.DETAILS;
      if (inlineEditMode == InlineEditMode.COMMENTS) {
        $scope.openNewComment();
      } else if (inlineEditMode == InlineEditMode.DIRECTIONS) {
        $scope.openDirections();
      } else if (inlineEditMode == InlineEditMode.TAGS) {
        $scope.openTagsEditor(); 
      }
    }
  });

  $scope.$watch(_.constant($filterModel), $scope.setMarkerState, true);
  $scope.$watch(_.constant($searchResultState), $scope.setMarkerState, true);
  $timeout($scope.setMarkerState);
}

function tcEntityDetails() {
  return {
    restrict: 'AE',
    templateUrl: 'one-entity-details-template',
    controller: EntityDetailsCtrl,
    scope: {
      entity: '=',
      tripPlanId: '=',
      isEditable: '=',
      forResults: '=',
      forGuide: '=',
      resultIndex: '='
    }
  };
}

function tcTripPlanDetailsHeader() {
  return {
    restrict: 'AE',
    templateUrl: 'trip-plan-details-header-template',
    scope: {
      tripPlan: '=',
      numEntities: '=',
      fullBleed: '=',
      clickable: '=',
      showBorder: '=',
      hiddenMode: '=',
      includeDetails: '=',
      includeCreator: '=',
      onClick: '&'
    }
  };
}

function InfowindowCtrl($scope, $tripPlanModel, $activeTripPlanState,
    $entityEditingService, $entityClippingService,
    $accountInfo, $window, $timeout) {
  $scope.inlineEditMode = null;
  $scope.InlineEditMode = InlineEditMode;

  $scope.showPrimaryControls = true;
  $scope.showSecondaryControls = false;

  $scope.tagState = {rawInput: null};
  $scope.newComment = {};

  $scope.openTagsEditor = function() {
    $scope.tagState.rawInput = _.pluck($scope.ed['tags'], 'text').join(', ');
    $scope.openInlineEditorInternal(InlineEditMode.TAGS);
  };

  $scope.closeTagsEditor = function() {
    $scope.tagState.rawInput = null;
    $scope.closeInlineEditorInternal();
  };

  $scope.saveTags = function() {
    $entityEditingService.saveTags($scope.ed, $scope.tagState.rawInput, function() {
      $scope.closeTagsEditor();
    });
  };

  $scope.openNewComment = function() {
    $scope.newComment = {
      'entity_id': $scope.ed['entity_id'],
      'text': null
    };
    $scope.openInlineEditorInternal(InlineEditMode.COMMENTS);
  };

  $scope.closeNewComment = function() {
    $scope.newComment = {};
    $scope.closeInlineEditorInternal();
  };

  $scope.saveNewComment = function() {
    $entityEditingService.saveNewComment($scope.newComment, function() {
      $scope.closeNewComment();
    });
  };

  $scope.showInfoSection = function() {
    return $scope.ed['day'] || $scope.ed['starred'] || $scope.ed['address_precision'] == 'Imprecise';
  };

  $scope.workspaceActive = function() {
    return !!$scope.inlineEditMode;
  };

  $scope.toggleTagsEdit = function() {
    if ($scope.inlineEditMode == InlineEditMode.TAGS) {
      $scope.closeTagsEditor();
    } else {
      $scope.openTagsEditor();
    }
  };

  $scope.toggleCommentsEdit = function() {
    if ($scope.inlineEditMode == InlineEditMode.COMMENTS) {
      $scope.closeNewComment();
    } else {
      if (!$accountInfo['logged_in']) {
        $window.alert('Please log in before making comments.');
        return;
      }
      $scope.openNewComment();
    }
  };

  $scope.toggleDirectionsEdit = function() {
    if ($scope.inlineEditMode == InlineEditMode.DIRECTIONS) {
      $scope.closeInlineEditorInternal();
    } else {
      $scope.openInlineEditorInternal(InlineEditMode.DIRECTIONS);
    }
  };

  $scope.openInlineEditorInternal = function(inlineEditMode) {
    $scope.inlineEditMode = inlineEditMode;
    $timeout($scope.onSizeChange);
  };

  $scope.closeInlineEditorInternal = function() {
    $scope.inlineEditMode = null;
    $timeout($scope.onSizeChange);
  };

  $scope.toggleControls = function() {
    $scope.showPrimaryControls = !$scope.showPrimaryControls;
    $scope.showSecondaryControls = !$scope.showSecondaryControls;
  };

  $scope.clipEntity = function() {
    $entityClippingService.clipEntity($scope.ed, $tripPlanModel.tripPlanId());
  };

  $scope.isAlreadySaved = function() {
    return $activeTripPlanState.isSaved($scope.ed);
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
      forResults: '=',
      resultLetter: '=',
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
        if ($scope.forResults) {
          classes.push('for-results');
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
      iconTemplateName: '=',
      forResults: '=',
      resultLetter: '=',
    },
    controller: function($scope) {
      $scope.getClasses = function() {
        var classes = [];
        if ($scope.categoryName) {
          classes.push($scope.categoryName);
        }
        if ($scope.forResults) {
          classes.push('for-results');
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

function HtmlInfowindow(marker, contentDiv, opt_options) {
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

  var opts = opt_options || {};
  this.options = {
    extraPaddingX: opts['extraPaddingX'] || 0,
    extraPaddingY: opts['extraPaddingY'] || 0

  };
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
  var padX = 40 + this.options.extraPaddingX;
  var padY = 40 + this.options.extraPaddingY;

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

function tcTripPlanSelector() {
  return {
    restrict: 'AE',
    templateUrl: 'trip-plan-selector-template',
    scope: {
      tripPlans: '=',
      selectedTripPlan: '=selectTripPlanTo',
      showCreateNew: '=',
      onCreateNewSelected: '&'
    },
    controller: function($scope) {
      $scope.$watch('tripPlans', function(tripPlans) {
        if (!tripPlans) return;
        $scope.tripPlanSelectOptions = tripPlans.slice(0);
        if ($scope.showCreateNew) {
          $scope.tripPlanSelectOptions.push({
            'name': 'Create a new trip',
            'trip_plan_id': 0,
            createNew: true
          });    
        }
        if (!$scope.selectedTripPlan) {
          $scope.selectedTripPlan = $scope.tripPlanSelectOptions[0];
        }
      }, true);
      $scope.$watch('selectedTripPlan', function(newValue) {
        if (newValue && newValue.createNew) {
          $scope.onCreateNewSelected();
        }
      });
    }
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

var InfoPanelMode = {
  DETAILS: 1,
  GUIDES: 2,
  ADD_YOUR_OWN: 3,
  EXPORT: 4,
  SHARING: 5,
  SETTINGS: 6
};

var EXTENDED_INFO_PANEL_MODES = [
  InfoPanelMode.EXPORT, InfoPanelMode.SHARING, InfoPanelMode.SETTINGS
];

function PageStateModel() {
  this.summaryPanelExpanded = true;
  this.infoPanelExpanded = true;
  this.infoPanelMode = InfoPanelMode.DETAILS;
  this.infoPanelShowExtendedNavItems = false;
  this.selectedEntity = null;
  this.showAfterNewTripPlanPanel = false;

  this.entityIsSelected = function(entityId) {
    return this.selectedEntity && this.selectedEntity['entity_id'] == entityId;
  };
}

function FilterModel() {
  this.searchResultsEmphasized = false;
  this.highlightedEntity = null;

  this.activeTagText = null;
  this.activeCategory = null;

  this.entityIsHighlighted = function(entityId) {
    return this.highlightedEntity && this.highlightedEntity['entity_id'] == entityId;
  };

  this.emphasisActive = function() {
    return this.emphasizedDayNumber != null || this.searchResultsEmphasized;
  };

  this.clear = function() {
    this.searchResultsEmphasized = false;
    this.highlightedEntity = null;
    this.activeTagText = null;
  };

  this.attributeFilteringActive = function() {
    return this.activeTagText || this.activeCategory;
  };

  this.setActiveTag = function(tag) {
    this.clearAttributeFilters();
    this.activeTagText = tag['text'].toLowerCase().trim();
  };

  this.hasActiveTag = function(tags) {
    if (!this.activeTagText || _.isEmpty(tags)) {
      return false;
    }
    for (var i = 0, I = tags.length; i < I; i++) {
      if (tags[i]['text'].toLowerCase().trim() == this.activeTagText) {
        return true;
      }
    }
    return false;
  };

  this.clearAttributeFilters = function() {
    this.activeTagText = null;
    this.activeCategory = null;
  };

  this.setActiveCategory = function(category) {
    this.clearAttributeFilters();
    this.activeCategory = category && category['category_id'] ? category : null;
  };

  this.hasActiveCategory = function(category) {
    return this.activeCategory && category
      && this.activeCategory['category_id'] == category['category_id'];
  };

  this.hasActiveAttributeFilter = function(entity) {
    return this.hasActiveTag(entity['tags']) || this.hasActiveCategory(entity['category']);
  };
}

function tcFilterBar() {
  return {
    restrict: 'AE',
    scope: {
      filterModel: '=',
      trackingLocation: '@'
    },
    templateUrl: 'filter-bar-template'
  };
}

function EntityDragStateModel(tripPlanModel) {
  this.draggedEntity = null;
  this.draggedElement = null;
  this.draggedElementHeight = null;
  this.activeComparisonEntity = null;

  this.orderedEntityIds = [];
  this.orderingMap = {};
  this.originalOrderedEntityIds = [];
  this.originalOrderingMap = {};

  this.setDraggedEntity = function(entity, element) {
    this.draggedEntity = entity;
    this.draggedElement = element;
    this.draggedElementHeight = element.height();
  };

  this.dragEnded = function() {
    this.draggedEntity = null;
    this.draggedElement = null
    this.draggedElementHeight = null;
    this.activeComparisonEntity = null;
    this.orderedEntityIds = angular.copy(this.originalOrderedEntityIds);
  };

  this.createOrdering = function(entities) {
    var me = this;
    $.each(entities, function(i, entity) {
      var entityId = entity['entity_id'];
      me.orderedEntityIds[i] = entityId;
      me.orderingMap[entityId] = i;
      me.originalOrderedEntityIds[i] = entityId;
      me.originalOrderingMap[entityId] = i;
    });
  };
  this.createOrdering(tripPlanModel.entities());

  this.draggingActive = function() {
    return !!this.draggedEntity;
  };

  this.isBeingDragged = function(entity) {
    return this.draggedEntity && this.draggedEntity['entity_id'] == entity['entity_id'];
  };

  this.isOrderedBeforeDraggedEntity = function(entity) {
    return this.orderingMap[entity['entity_id']]
      < this.originalOrderingMap[this.draggedEntity['entity_id']];
  };

  this.isOrderedAfterDraggedEntity = function(entity) {
    return this.orderingMap[entity['entity_id']]
      > this.originalOrderingMap[this.draggedEntity['entity_id']];
  };

  this.swapPositions = function(entity) {
    if (this.activeComparisonEntity === entity) {
      return;
    }
    this.activeComparisonEntity = entity;
    var targetIndex = this.orderingMap[entity['entity_id']];
    var currentIndex = this.orderingMap[this.draggedEntity['entity_id']];
    this.orderedEntityIds.splice(currentIndex, 1);
    this.orderedEntityIds.splice(targetIndex, 0, this.draggedEntity['entity_id']);
    var newOrderingMap = {};
    $.each(this.orderedEntityIds, function(i, entityId) {
      newOrderingMap[entityId] = i;
    });
    this.orderingMap = newOrderingMap;
  };

  this.orderingChanged = function() {
    return this.orderedEntityIds != this.originalOrderedEntityIds;
  };

  this.shiftHeight = function() {
    return this.draggedElementHeight;
  };
}

function DataCache() {
  this.guides = null;

  this.clear = function() {
    this.guides = null;
  };
}

function RootCtrl($scope, $http, $timeout, $modal, $tripPlanService,
    $tripPlanModel, $tripPlan, $map, $pageStateModel, $filterModel,
    $searchResultState, $entityDragStateModel, $entityService,
    $allowEditing, $accountInfo, $allTripPlans, $activeTripPlanState,
    $hasGuides, $flashedMessages, $eventTracker) {
  var me = this;
  $scope.accountInfo = $accountInfo;
  $scope.pageStateModel = $pageStateModel;
  $scope.searchResultState = $searchResultState;
  $scope.InfoPanelMode = InfoPanelMode;
  $scope.planModel = $tripPlanModel;
  $scope.filterModel = $filterModel;
  $scope.allowEditing = $allowEditing;
  $scope.allTripPlans = $allTripPlans;
  $scope.activeTripPlanState = $activeTripPlanState;
  $scope.hasGuides = $hasGuides;
  $scope.flashedMessages = $flashedMessages;
  $scope.et = $eventTracker;
  $scope.refreshState = {
    paused: false
  };

  $scope.resetMapState = function() {
    $scope.$broadcast('closeallinfowindows');
    $map.fitBounds($tripPlanModel.getMapBounds());
    $filterModel.emphasizedDayNumber = null;
  };

  $scope.openInfoPanel = function() {
    $pageStateModel.infoPanelExpanded = true;
  };

  $scope.closeInfoPanel = function() {
    $pageStateModel.infoPanelExpanded = false;
    $pageStateModel.infoPanelMode = InfoPanelMode.DETAILS;
    $scope.$broadcast('closeallinfowindows');
    $pageStateModel.selectedEntity = null;
    $searchResultState.clear();
    $filterModel.searchResultsEmphasized = false;
    $scope.$broadcast('infopanelclosing');
  };

  $scope.openDetailsPanel = function() {
    $scope.goToInfoPanel(InfoPanelMode.DETAILS);
  };

  $scope.goToInfoPanel = function(infoPanelMode) {
    $pageStateModel.infoPanelMode = infoPanelMode;
    $pageStateModel.infoPanelShowExtendedNavItems = 
      _.contains(EXTENDED_INFO_PANEL_MODES, infoPanelMode);
    $scope.openInfoPanel();
    $searchResultState.clear();
    $filterModel.clear();
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

  var initialBounds = $tripPlanModel.getMapBounds();
  if (initialBounds) {
    $map.fitBounds(initialBounds);
  }

  $scope.$on('asktocloseallinfowindows', function() {
    $scope.$broadcast('closeallinfowindows');
  });

  $scope.$on('asktocloseallcontrols', function() {
    $scope.$broadcast('closeallcontrols');
  });

  $scope.$watch(function() {
    return $tripPlanModel.entities();
  }, function(entities) {
    if (entities) {
      $entityDragStateModel.createOrdering(entities);
    }
  }, true);

  this.refresh = function(opt_force, opt_callback) {
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
        $tripPlanModel.updateLastModified(response['last_modified']);
        $tripPlanModel.resetEntities(response['entities']);
        $map.fitBounds($tripPlanModel.getMapBounds());
        opt_callback && opt_callback;
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

  if ($allowEditing) {
    var refreshInterval = 5000;
    function refreshPoll() {
      me.refresh();
      $timeout(refreshPoll, refreshInterval);
    }
    $timeout(refreshPoll, refreshInterval);
  }
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
      position: google.maps.ControlPosition.BOTTOM_LEFT
    },
    zoomControlOptions: {
      style: google.maps.ZoomControlStyle.SMALL,
      position: google.maps.ControlPosition.LEFT_BOTTOM
    }
  };
  var map = new google.maps.Map($('#map')[0], mapOptions);
  if (tripPlanData['location_bounds']) {
    map.fitBounds(gmapsBoundsFromJson(tripPlanData['location_bounds']));
  }
  return map;
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

function SizeHelper($window) {
  this.widthPercentToPixels = function(percentAsDecimal) {
    return parseInt($window.innerWidth * percentAsDecimal);
  };

  this.heightPercentToPixels = function(percentAsDecimal) {
    return parseInt($window.innerHeight * percentAsDecimal);
  };
}

function DetailsPanelCtrl($scope, $tripPlanModel, $tripPlanService) {
  $scope.relatedGuides = null;

  if ($tripPlanModel.isGuide()) {
    $tripPlanService.findTripPlans($tripPlanModel.tripPlanData['location_latlng'])
      .success(function(response) {
        var guides = response['trip_plans'];
        var currentGuide = _.find(guides, function(guide) {
          return guide['trip_plan_id'] == $tripPlanModel.tripPlanid();
        });
        $scope.relatedGuides = generateRelatedGuides(guides, currentGuide);
      });      
  }
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
    $searchResultState.results = $scope.searchResults;
    $scope.loadingData = false;
    $scope.searchComplete = true;
    $mapManager.fitBoundsToEntities($scope.searchResults);
    $filterModel.searchResultsEmphasized = true;
    $filterModel.emphasizedDayNumber = null;
  };
}

function GuidesPanelCtrl($scope, $tripPlanModel, $tripPlanService,
    $mapManager, $filterModel, $searchResultState, $dataCache, $eventTracker) {
  $scope.locationName = $tripPlanModel.tripPlanData['location_name'];
  $scope.loading = false;
  $scope.guides = null;
  $scope.selectedGuide = null;
  $scope.relatedGuides = null;

  if ($dataCache.guides) {
    $scope.guides = $dataCache.guides;
  } else {
    $scope.loading = true;
    $tripPlanService.findTripPlans($tripPlanModel.tripPlanData['location_latlng'])
      .success(function(response) {
        $scope.loading = false;
        $scope.guides = response['trip_plans'];
        $dataCache.guides = $scope.guides;
        if (_.isEmpty($scope.guides)) {
          $eventTracker.track({name: 'guides-panel-load-no-guides', value: $tripPlanModel.tripPlanData['location_name']});
        } else {
          $eventTracker.track({name: 'guides-panel-load-has-guides', value: $tripPlanModel.tripPlanData['location_name']});
        }
      });    
  }

  $scope.selectGuide = function(guide) {
    $scope.selectedGuide = guide;
    $mapManager.fitBoundsToEntities(guide['entities']);
    $filterModel.searchResultsEmphasized = true;
    $scope.relatedGuides = generateRelatedGuides($scope.guides, guide);
  };

  $scope.backToListings = function() {
    $scope.selectedGuide = null;
    $filterModel.searchResultsEmphasized = false;
    $searchResultState.clear();
  };
}

var MAX_NUM_RELATED_GUIDES = 3;

function generateRelatedGuides(guides, selectedGuide) {
  return _.chain(guides)
    .sample(MAX_NUM_RELATED_GUIDES + 1)
    .without(selectedGuide)
    .value()
    .slice(0, MAX_NUM_RELATED_GUIDES);
};

var AddYourOwnTab = {
  SEARCH: 1,
  CLIPPER: 2,
  PASTE_LINK: 3
};

var ResultType = {
  SEARCH: 1,
  ENTITY_LOOKUP: 2
};

function AddYourOwnPanelCtrl($scope, $tripPlanModel, $searchResultState,
    $filterModel, $entityService, $mapManager, $browserInfo,
    $eventTracker, $window, $timeout) {

  $scope.tab = AddYourOwnTab.SEARCH;
  $scope.AddYourOwnTab = AddYourOwnTab;

  $scope.selectTab = function(tab) {
    $scope.tab = tab;
  };

  $scope.searchState = {
    rawInput: null,
    searching: false,
    searchComplete: false,
    results: null,
    resultType: null
  };
  $scope.ResultType = ResultType;

  $scope.googlePlaceSelected = function(place) {
    $scope.searchState.searching = true;
    $scope.searchState.searchComplete = false;
    $scope.searchState.results = null;
    $scope.searchState.resultType = null;
    $searchResultState.clear();
    if (place['reference']) {
      $entityService.googleplacetoentity(place['reference'])
        .success($scope.processSearchResponse);
      $eventTracker.track({name: 'add-your-own-autocomplete',
        location: 'add-your-own-panel', value: place['name']});
    } else {
      $entityService.googletextsearchtoentities(place['name'],
        $tripPlanModel.tripPlanData['location_latlng'])
          .success($scope.processSearchResponse);
      $eventTracker.track({name: 'add-your-own-text-search',
        location: 'add-your-own-panel', value: place['name']});
    }
  };

  $scope.processSearchResponse = function(response) {
    if (response['entity']) {
      $scope.searchState.results = [response['entity']]
      $scope.searchState.resultType = ResultType.ENTITY_LOOKUP;
    } else {
      $scope.searchState.results = response['entities'] || [];
      $scope.searchState.resultType = ResultType.SEARCH;
    }
    $scope.searchResultState.results = $scope.searchState.results;
    $scope.searchState.searching = false;
    $scope.searchState.searchComplete = true;
    $mapManager.fitBoundsToEntities($scope.searchState.results);
    $filterModel.searchResultsEmphasized = true;
  };

  $scope.hasNoSearchResults = function() {
    return !$scope.searchState.searching && $scope.searchState.searchComplete
      && _.isEmpty($scope.searchState.results);
  };

  $scope.sampleSupportedSites = SAMPLE_SUPPORTED_SITES;
  $scope.browserInfo = $browserInfo;
  $scope.BrowserPlatform = BrowserPlatform;
  $scope.BrowserApp = BrowserApp;

  $scope.showClipperHelp = false;

  $scope.toggleHelp = function() {
    $scope.showClipperHelp = !$scope.showClipperHelp;
  };

  $scope.linkState = {
    rawInput: null,
    loading: false,
    loadingComplete: false,
    results: null,
    invalidUrl: false,
    siteDomain: null,
    formattedUrl: null
  };

  $scope.linkPasted = function() {
    // Ugly hack to wrap this in a timeout; without it, the paste event
    // fires before the input has been populated with the pasted data.
    $timeout(function() {
      $scope.linkState.loading = true;
      $scope.linkState.loadingComplete = false;
      $scope.linkState.results = null;
      $scope.linkState.invalidUrl = false;
      $scope.linkState.siteDomain = null;
      $scope.linkState.formattedUrl = null;
      $entityService.urltoentities($scope.linkState.rawInput)
        .success($scope.processLinkClipResponse);

      $eventTracker.track({name: 'clip-link-pasted',
        location: 'add-your-own-paste-link-panel', value: $scope.linkState.rawInput})
    });
  };

  $scope.processLinkClipResponse = function(response) {
    $scope.linkState.results = response['entities'];
    $scope.linkState.loading = false;
    $scope.linkState.loadingComplete = true;
    $scope.linkState.siteDomain = hostnameFromUrl($scope.linkState.rawInput);
    $scope.linkState.formattedUrl = urlWithProtocol($scope.linkState.rawInput);
    $mapManager.fitBoundsToEntities($scope.linkState.results);
    $filterModel.searchResultsEmphasized = true;
    $searchResultState.clear();
  };

  $scope.noLinkResults = function() {
    return !$scope.linkState.loading && $scope.linkState.loadingComplete
      && _.isEmpty($scope.linkState.results);
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

var EditorTab = {
  NAME_AND_DESCRIPTION: 1,
  DETAILS: 2,
  ADDRESS_AND_LOCATION: 3,
  PHOTOS: 4
};

function EditPlaceCtrl($scope, $tripPlanModel, $taxonomy,
    $entityService, $entityEditingService, $eventTracker, $timeout) {
  var me = this;
  $scope.ed = angular.copy($scope.originalEntity);
  $scope.em = new EntityModel($scope.ed);
  $scope.editorTab = EditorTab.NAME_AND_DESCRIPTION;
  $scope.EditorTab = EditorTab;
  $scope.locationBounds = $tripPlanModel.tripPlanData['location_bounds'];
  $scope.selectedPhoto = {index: null};
  $scope.photoEditState = {
    rawInput: null,
    dragActive: false
  };
  $scope.tagState = {
    rawInput: _.pluck($scope.ed['tags'], 'text').join(', ')
  };
  $scope.mapState = {map: null};

  $scope.et = $eventTracker;
  $scope.trackingLocation = 'entity-editor';

  $scope.categories = $taxonomy.allCategories();
  $scope.getSubCategories = function(categoryId) {
    return $taxonomy.getSubCategoriesForCategory(categoryId);
  };

  $scope.selectTab = function(editorTab) {
    $scope.editorTab = editorTab;
  }

  $scope.markerDragged = function($position) {
    var entityData = $scope.ed;
    if (_.isEmpty(entityData['latlng'])) {
      entityData['latlng'] = {};
    }
    entityData['latlng']['lat'] = $position.lat();
    entityData['latlng']['lng'] = $position.lng();
    entityData['address_precision'] = 'Precise';
    $eventTracker.track({name: 'marker-dragged',
      location: $scope.trackingLocation, value: $scope.ed['entity_id']});
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
    $map.setCenter(me.findMapCenter());
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
    $eventTracker.track({name: 'address-changed',
      location: $scope.trackingLocation, value: $scope.ed['address']});
  }

  $scope.tagsChanged = function() {
    var tags = [];
    $.each($scope.tagState.rawInput.split(','), function(i, str) {
      var tagText = str.trim();
      if (tagText) {
        tags.push({'text': tagText});
      }
    });
    $scope.ed['tags'] = tags;
  };

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

  $scope.saveEntity = function() {
    $entityService.editEntity($scope.ed, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          var doneSaving = function() {
            $tripPlanModel.updateEntities(response['entities']);
            $tripPlanModel.updateLastModified(response['last_modified']);
            $scope.$close();
          }
          if (_.isEmpty($scope.ed['tags']) && !_.isEmpty($scope.originalEntity['tags'])) {
            $entityEditingService.saveTags($scope.ed, $scope.tagState.rawInput, doneSaving);
          } else {
            doneSaving();
          }
        }
      })
      .error(function() {
        alert('Failed to save, please try again.');
      });
  };

  $scope.photoDropTargetDragenter = function($event) {
    $scope.photoEditState.dragActive = true;
    $event.preventDefault();
  };

  $scope.photoDropTargetDragleave = function() {
    $scope.photoEditState.dragActive = false;
  };

  $scope.photoDropped = function($event) {
    var imgUrl = $event.originalEvent.dataTransfer.getData('text/uri-list');
    if (imgUrl) {
      $scope.ed['photo_urls'].push(imgUrl);
      $scope.selectedPhoto.index = $scope.ed['photo_urls'].length - 1;
    }
    $scope.photoEditState.dragActive = false;
    $event.stopPropagation();
    $event.preventDefault();
    $eventTracker.track({name: 'photo-dropped', location: $scope.trackingLocation, value: imgUrl});
  };

  $scope.photoUrlPasted = function() {
    $timeout(function() {
      var url = $scope.photoEditState.rawInput;
      if (url) {
        $scope.ed['photo_urls'].push(url);
        $scope.selectedPhoto.index = $scope.ed['photo_urls'].length - 1;        
        $scope.photoEditState.rawInput = '';
      }
      $eventTracker.track({name: 'photo-url-pasted', location: $scope.trackingLocation, value: url});
    });
  };
}

function TripPlanSettingsEditorCtrl($scope, $tripPlanModel, $tripPlanService,
    $eventTracker, $timeout, $window, $document) {
  $scope.tpd = angular.copy($tripPlanModel.tripPlanData);
  $scope.editingImage = !$scope.tpd['cover_image_url'];
  $scope.coverImgDragActive = false;
  $scope.coverImgUrlInput = {text: ''};
  $scope.saveComplete = false;
  $scope.tagState = {
    rawInput: _.pluck($scope.tpd['tags'], 'text').join(', ')
  };

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
      $window.alert("Couldn't recognize this image.")
    }
    $event.stopPropagation();
    $event.preventDefault();
    $scope.coverImgDragActive = false;
    $scope.editingImage = false;
    $eventTracker.track({name: 'cover-image-dropped',
      location: 'settings-panel', value: imgUrl});
  };

  var pasteActive = false;

  $scope.coverImgUrlPasted = function() {
    pasteActive = true;
    $timeout(function() {
      $scope.tpd['cover_image_url'] = $scope.coverImgUrlInput.text;
      $scope.coverImgUrlInput.text = '';
      pasteActive = false;
      $scope.editingImage = false;
      $eventTracker.track({name: 'cover-image-pasted',
        location: 'settings-panel', value: $scope.tpd['cover_image_url']});
    });
  };

  $scope.coverImgUrlChanged = function() {
    if (!pasteActive) {
      $scope.coverImgUrlInput.text = '';
    }
  };

  $scope.saveSettings = function() {
    $scope.saveComplete = false;
    $tripPlanService.editTripPlan($scope.tpd)
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          if (_.isEmpty($scope.tpd['tags'])
            && !_.isEmpty($tripPlanModel.tripPlanData['tags'])) {
            // We can't delete all tags in a normal EDIT request, since
            // an empty list of tags is ignored.  So we have to send
            // a followup request to clear the tags.
            $tripPlanService.deleteTags($tripPlanModel.tripPlanId())
              .success($scope.handleSaveResponse);
          } else {
            $scope.handleSaveResponse(response);
          }
        }
      })
      .error(function() {
        $window.alert('Error saving trip plan, please try again.');
      });
  };

  $scope.handleSaveResponse = function(response) {
    $tripPlanModel.updateTripPlan(response['trip_plans'][0]);
    $document[0].title = response['trip_plans'][0]['name'];
    $scope.saveComplete = true;
  };

  $scope.deleteTripPlan = function() {
    var ok = $window.confirm('Are you sure you want to delete this trip plan?');
    if (!ok) {
      return;
    }
    $tripPlanService.deleteTripPlanById($tripPlanModel.tripPlanId())
      .success(function(response) {
        $window.location.href = '/trip_plan';
      });
  };

  $scope.tagsChanged = function() {
    var tags = [];
    var tagsString = $scope.tagState.rawInput;
    $.each(tagsString.split(','), function(i, str) {
      var tagText = str.trim();
      if (tagText) {
        tags.push({'text': tagText});
      }
    });
    $scope.tpd['tags'] = tags;
  };
}

function SharingSettingsCtrl($scope, $tripPlanModel, $accountInfo, $tripPlanService, $location) {
  $scope.formState = {email: null};
  $scope.accountInfo = $accountInfo;
  $scope.creator = $tripPlanModel.tripPlanData['user'];
  $scope.shareUrl = 'https://' + $location.host()  + '/trip_plan/' + $tripPlanModel.tripPlanId();

  $scope.isCurrentUser = function(user) {
    return user['public_id'] == $accountInfo['user']['public_id']
  };

  $scope.editors = function() {
    return $tripPlanModel.tripPlanData['editors'] || [];
  };

  $scope.inviteeEmails = function() {
    return $tripPlanModel.tripPlanData['invitee_emails'] || [];
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

function GmapsImporterCtrl($scope, $timeout, $tripPlanService,
    $entityService, $tripPlanModel, $searchResultState, $mapManager,
    $eventTracker) {
  var me = this;
  $scope.url = '';
  $scope.importing = false;
  $scope.saving = false;
  $scope.allSaved = false;
  $scope.importedTripPlan = null;
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
      $scope.importedTripPlan = null;
      $tripPlanService.gmapsimport($scope.url)
        .success(function(response) {
          if (response['response_code'] == ResponseCode.SUCCESS) {
            $scope.importedTripPlan = response['trip_plan'];
            $scope.importing = false;
            $scope.allSaved = false;
            $searchResultState.savedResultIndices = [];
            $mapManager.fitBoundsToEntities($scope.importedTripPlan['entities']);
          } else if (extractError(response, TripPlanServiceError.INVALID_GOOGLE_MAPS_URL)) {
            $scope.urlInvalid = true;
            $scope.importing = false;
          }
        });
        $eventTracker.track({name: 'gmaps-url-pasted', location: 'import-panel', value: $scope.url});
      });
  };

  $scope.saveAllPendingPlacesToTrip = function() {
    $scope.saving = true;
    $entityService.saveNewEntities($scope.importedTripPlan['entities'], $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $scope.saving = false;
          $scope.allSaved = true;
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.addNewEntities(response['entities']);
          $.each($scope.importedTripPlan['entities'], function(i, entity) {
            $searchResultState.savedResultIndices[i] = true;
          });
        }
      });
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

function EntityCtrlProxy($rootScope, $pageStateModel) {
  this.selectEntity = function(entity) {
    $rootScope.$broadcast('entity-selected', entity);
  };

  this.openInlineEdit = function(entity, inlineEditMode) {
    $rootScope.$broadcast('open-inline-edit', entity, inlineEditMode);
  };
}

function EntityEditingService($entityService, $tripPlanModel,
  $modal, $rootScope, $window) {
  this.saveStarState = function(entity, starred) {
    entity['starred'] = starred;
    $entityService.editEntity({
      'entity_id': entity['entity_id'],
      'starred': starred
    }, $tripPlanModel.tripPlanId())
    .success(function(response) {
      $tripPlanModel.updateLastModified(response['last_modified']);
    });
  };

  this.deleteEntity = function(entity) {
    var ok = $window.confirm('Are you sure you want to delete this place?');
    if (!ok) {
      return;
    }
    $entityService.deleteEntity(entity, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          $tripPlanModel.removeEntities(response['entities']);
        } else {
          alert('Error while deleting place');
        }
      }).error(function() {
        alert('Error while deleting place')
      });
  };

  this.openEditPlaceModal = function(entity) {
    var scope = $rootScope.$new(true);
    scope.originalEntity = angular.copy(entity);
    $modal.open({
      templateUrl: 'edit-place-modal-template',
      windowClass: 'edit-place-modal',
      scope: scope
    });
  };

  this.saveNewComment = function(comment, opt_success) {
    if (!comment['text']) {
      return;
    }
    $entityService.addComment(comment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.addNewComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          opt_success && opt_success();
        }
      });
  };

  this.saveCommentEdit = function(comment, opt_success) {
    if (!comment['text']) {
      return;
    }
    $entityService.editComment(comment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          opt_success && opt_success();
        }
      });
  };

  this.deleteComment = function(comment, opt_success) {
    if (!$window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    $entityService.deleteComment(comment, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.removeComments(response['comments']);
          $tripPlanModel.updateLastModified(response['last_modified']);
          opt_success && opt_success();
        }
      });
  };

  this.saveTags = function(entity, tagsString, opt_success) {
    var tags = [];
    $.each(tagsString.split(','), function(i, str) {
      var tagText = str.trim();
      if (tagText) {
        tags.push({'text': tagText});
      }
    });
    if (_.isEmpty(tags)) {
      $entityService.deleteTags(entity['entity_id'], $tripPlanModel.tripPlanId())
        .success(function(response) {
          if (response['response_code'] == ResponseCode.SUCCESS) {
            $tripPlanModel.updateLastModified(response['last_modified']);
            entity['tags'] = response['entities'][0]['tags'];
            opt_success && opt_success();
          }
        });
    } else {
      var entityToEdit = {
        'entity_id': entity['entity_id'],
        'tags': tags
      };
      $entityService.editEntity(entityToEdit, $tripPlanModel.tripPlanId())
        .success(function(response) {
          if (response['response_code'] == ResponseCode.SUCCESS) {
            $tripPlanModel.updateLastModified(response['last_modified']);
            entity['tags'] = response['entities'][0]['tags'];
            opt_success && opt_success();
          }
        });
    }
  };

  this.saveDescription = function(entity, description, opt_success) {
     var entityToEdit = {
      'entity_id': entity['entity_id'],
      'description': description
    };
    $entityService.editEntity(entityToEdit, $tripPlanModel.tripPlanId())
      .success(function(response) {
        if (response['response_code'] == ResponseCode.SUCCESS) {
          $tripPlanModel.updateLastModified(response['last_modified']);
          entity['description'] = response['entities'][0]['description'];
          opt_success && opt_success();
        }
      });
  };
}

function EntityClippingService($entityService, $tripPlanCreator, $activeTripPlanState,
  $tripPlanModel, $pageStateModel, $searchResultState, $allowEditing) {

  this.clipEntity = function(entity, sourceTripPlanId, resultIndex, opt_success) {
    var entityToSave = angular.copy(entity);
    $.each(['entity_id', 'starred', 'day', 'day_position', 'comments'], function(i, prop) {
      delete entityToSave[prop];
      if (!entityToSave['origin_trip_plan_id']) {
        entityToSave['origin_trip_plan_id'] = sourceTripPlanId;
      }
    });

    if ($allowEditing) {
      $entityService.saveNewEntity(entityToSave, $tripPlanModel.tripPlanId())
        .success(function(response) {
          if (response['response_code'] == ResponseCode.SUCCESS) {
            $tripPlanModel.updateLastModified(response['last_modified']);
            $tripPlanModel.addNewEntities(response['entities']);
            $pageStateModel.selectedEntity = response['entities'][0];
            $searchResultState.savedResultIndices[resultIndex] = true;
            opt_success && opt_success();
          }
        });
    } else {
      var doShoppingCartClip = function() {
        $entityService.saveNewEntity(entityToSave, $activeTripPlanState.tripPlan['trip_plan_id'])
          .success(function(response) {
            $activeTripPlanState.numEntities += 1;
            $activeTripPlanState.savedEntityIds[entity['entity_id']] = true;
            $activeTripPlanState.lastClippedEntity = response['entities'][0];
            if ($activeTripPlanState.numEntities == 1) {
              $pageStateModel.showAfterNewTripPlanPanel = true;            
            }
            opt_success && opt_success();
          });
      };
      if (!$activeTripPlanState.tripPlan) {
        $tripPlanCreator.openNewTripPlanModal(doShoppingCartClip, entityToSave);
      } else {
        doShoppingCartClip();
      }      
    }
  };
}

function DirectionsHelper(entities, $window) {
  this.entities = entities;
  this.direction = 'from';
  this.destination = null;

  this.toggleDirection = function() {
    this.direction = this.direction == 'to' ? 'from' : 'to';
  };

  this.getDirections = function(originEntity) {
    if (!this.destination) {
      return;
    }
    var origin = this.direction == 'to'
      ? originEntity : this.destination;
    var destination = this.direction == 'to'
      ? this.destination : originEntity;
    var url = 'https://www.google.com/maps/dir/' + 
      new EntityModel(origin).latlngString() + '/' +
      new EntityModel(destination).latlngString();
    $window.open(url, '_blank');
  };

  this.reset = function() {
    this.direction = 'from';
    this.destination = null;
  };
}

function tcAfterNewTripPlanPanel($timeout, $window) {
  return {
    restrict: 'AE',
    scope: {
      onClose: '&'
    },
    templateUrl: 'after-new-trip-plan-panel-template',
    controller: function($scope, $activeTripPlanState, $window) {
      $scope.activeTripPlanState = $activeTripPlanState;
      $scope.goToTripPlan = function() {
        $window.location.href = '/trip_plan/' + $activeTripPlanState.tripPlan['trip_plan_id'];
      }
    },
    link: function(scope, element, attrs) {
      $timeout(function() {
        var connector = $("#after-new-trip-plan-panel .connector");
        var connectorAlignmentElem = $(attrs.alignConnectorTo);
        connector.css('left', connectorAlignmentElem.offset().left);
        $($window).on('resize', function() {
          connector.css('left', connectorAlignmentElem.offset().left);
        });
      });
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

function tcResetScrollTopOn() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.$watch(attrs.tcResetScrollTopOn, function(newValue, oldValue) {
        if (newValue && newValue !== oldValue) {
          element.scrollTop(0);
        }
      });
    }
  };
}

function tcScrollOnClick() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var scrollParent = $(attrs.scrollParent);
      var scrollTarget = $(attrs.scrollTarget);
      element.on('click', function() {
        var newScrollTop = scrollParent.offset().top - scrollTarget.offset().top;
        scrollParent.animate({scrollTop: newScrollTop}, 500);
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
      value: '=',
      max: '='
    },
    templateUrl: 'star-rating-template',
    controller: function($scope) {
      $scope.maxRange = new Array($scope.max);
      for (var i = 0; i < $scope.max; i++) {
        $scope.maxRange[i] = i;
      }
    }
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
      trackChange: '&',
      fullBleed: '=',
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
          $scope.trackChange && $scope.trackChange();
        }
      };

      $scope.prevImg = function() {
        if ($scope.hasPrevImg()) {
          $scope.currentIndex_--;
          me.notifyChange();
          $scope.trackChange && $scope.trackChange();
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

function tcAnimateOnChangeTo() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.$watch(attrs.tcAnimateOnChangeTo, function(newValue, oldValue) {
        if (newValue != null && newValue != undefined
          && oldValue != null && newValue != undefined
          && newValue !== oldValue) {
          element.addClass(attrs.classToAdd);
          if (attrs.removeWhenComplete) {
            element.on('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend',
              function() {
                element.removeClass(attrs.classToAdd);
              });
          }
        }
      });
    }
  };
};

function tcExpandableContent($timeout) {
  return {
    restrict: 'AE',
    templateUrl: 'expandable-content-template',
    scope: {
      textContent: '=',
      expandLinkText: '@',
      collapseLinkText: '@',
      maxLines: '=',
      numBufferLines: '=',
      trackExpand: '=',
      trackCollapse: '='
    },
    link: function(scope, element, attrs) {
      var contentElem = element.find('.text-content');
      $timeout(function() {
        var fullHeight = contentElem.height();
        var lineHeight = parseInt(contentElem.css('line-height').replace('px', ''));
        var maxHeight = scope.maxLines * lineHeight;
        // Allow the content to be up to 1 line longer than the max
        // if that's all it takes to render the whole thing, otherwise
        // we render an expander link for 1 line which looks stupid.
        var numBufferLines = _.isNumber(scope.numBufferLines)
          ? scope.numBufferLines : 2;
        var maxHeightWithBuffer = (scope.maxLines + numBufferLines) * lineHeight;
        scope.needsExpansion = fullHeight > maxHeightWithBuffer;
        if (scope.needsExpansion) {
          contentElem.css('height', maxHeight);
        }
        scope.$watch('isExpanded', function(isExpanded, wasExpanded) {
          if (isExpanded == wasExpanded) {
            return;
          }
          contentElem.css('height', isExpanded ? '' : maxHeight);
        });
      });
    },
    controller: function($scope) {
      $scope.isExpanded = false;
      $scope.needsExpansion = null;

      $scope.toggleExpanded = function() {
        $scope.isExpanded = !$scope.isExpanded;
      };
    }
  };
}

function tcDraggable() {
  return {
    restrict: 'AC',
    link: function(scope, element, attrs) {
      scope.$watch(attrs.tcDraggable, function(draggable) {
        element.attr('draggable', draggable);
      });
    }
  };
}

function tcLinkHeights($timeout) {
  return {
    restrict: 'AC',
    link: function(scope, element, attrs) {
      var heightElem = $(attrs.tcLinkHeights)[0];
      scope.$watch(function() {
        return heightElem.scrollHeight;
      }, function(newHeight, oldHeight) {
        if (newHeight != undefined) {
          element.css('height', newHeight);
        }
      });
      if (attrs.heightWatchExpr) {
        scope.$watch(attrs.heightWatchExpr, function() {
          $timeout(function() {
            element.css('height', heightElem.scrollHeight);
          });
        }, true);
      }
    }
  };
}

function tcSetNanoScrollbars($timeout) {
  return {
    restrict: 'AC',
    link: function(scope, element, attrs) {
      var scrollElem = element.find('.nano-content')[0];
      $timeout(function() {
        element.nanoScroller();
      });
      scope.$watch(function () {
        return scrollElem.scrollHeight;
      }, function(newHeight, oldHeight) {
        $timeout(function() {
          element.nanoScroller();
        });
      });
      scope.$on("$destroy", function () {
        element.nanoScroller({ destroy: true });
      });
    }
  };
}

var BrowserPlatform = {
  WINDOWS: 1,
  MAC: 2
};

var BrowserApp = {
  CHROME: 1,
  FIREFOX: 2,
  SAFARI: 3,
  IE: 4
};

function BrowserInfo(platform, app) {
  this.platform = platform;
  this.app = app;
}

BrowserInfo.parse = function(userAgent) {
  var platform = null;
  var app = null;

  if (userAgent.indexOf('Win') != -1) {
    platform = BrowserPlatform.WINDOWS;
  } else if (userAgent.indexOf('Mac') != -1) {
    platform = BrowserPlatform.MAC;
  }

  if (userAgent.indexOf('Chrome') != -1) {
    app = BrowserApp.CHROME;
  } else if (userAgent.indexOf('Firefox') != -1) {
    app = BrowserApp.FIREFOX;
  } else if (userAgent.indexOf('Safari') != -1) {
    app = BrowserApp.SAFARI;
  } else if (userAgent.indexOf('MSIE') != -1) {
    app = BrowserApp.IE;
  }

  return new BrowserInfo(platform, app);
};

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
  .directive('tcResetScrollTopOn', tcResetScrollTopOn)
  .directive('tcScrollOnClick', tcScrollOnClick)
  .directive('tcAnimateOnBool', tcAnimateOnBool)
  .directive('tcTransitionend', tcTransitionend)
  .directive('tcIncludeAndReplace', tcIncludeAndReplace)
  .directive('tcIcon', tcIcon)
  .directive('tcSvgHack', tcSvgHack)
  .directive('tcAnimateOnChangeTo', tcAnimateOnChangeTo)
  .directive('tcExpandableContent', tcExpandableContent)
  .directive('tcDraggable', tcDraggable);

function makeFilter(fn) {
  return function() {
    return fn;
  };
}

angular.module('filtersModule', [])
  .filter('hostname', makeFilter(hostnameFromUrl))
  .filter('hostNoSuffix', makeFilter(hostNoSuffix))
  .filter('hostToIcon', makeFilter(hostToIcon));

window['initApp'] = function(tripPlan, entities,
    allTripPlans, activeTripPlan, activeTripPlanEntityCount,
    accountInfo, datatypeValues, allowEditing, sampleSites,
    hasGuides, flashedMessages) {

  var tripPlanModel = new TripPlanModel(tripPlan, entities);
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanModel', tripPlanModel)
    .value('$allTripPlans', allTripPlans)
    .value('$activeTripPlanState', new ActiveTripPlanStateModel(
      allowEditing ? tripPlan : activeTripPlan, activeTripPlanEntityCount))
    .value('$pageStateModel', new PageStateModel())
    .value('$filterModel', new FilterModel())
    .value('$searchResultState', new SearchResultState())
    .value('$entityDragStateModel', new EntityDragStateModel(tripPlanModel))
    .value('$taxonomy', new TaxonomyTree(datatypeValues['categories'], datatypeValues['sub_categories']))
    .value('$accountInfo', accountInfo)
    .value('$allowEditing', allowEditing)
    .value('$sampleSites', sampleSites)
    .value('$hasGuides', hasGuides)
    .value('$flashedMessages', flashedMessages)
    .value('$browserInfo', BrowserInfo.parse(navigator.userAgent))
    .value('$dataCache', new DataCache());

  angular.module('mapModule', [])
    .value('$map', createMap(tripPlan));

  angular.module('appModule', ['navModule', 'mapModule', 'initialDataModule', 
      'servicesModule', 'directivesModule', 'filtersModule',
      'ui.bootstrap', 'ngSanitize', 'ngAnimate'],
      interpolator)
    .controller('RootCtrl', RootCtrl)
    .controller('EntitySummaryCtrl', EntitySummaryCtrl)
    .controller('InfowindowCtrl', InfowindowCtrl)
    .controller('CarouselCtrl', CarouselCtrl)
    .controller('DetailsPanelCtrl', DetailsPanelCtrl)
    .controller('GuidesPanelCtrl', GuidesPanelCtrl)
    .controller('SearchPanelCtrl', SearchPanelCtrl)
    .controller('AddYourOwnPanelCtrl', AddYourOwnPanelCtrl)
    .controller('EditPlaceCtrl', EditPlaceCtrl)
    .controller('TripPlanSettingsEditorCtrl', TripPlanSettingsEditorCtrl)
    .controller('SharingSettingsCtrl', SharingSettingsCtrl)
    .controller('GmapsImporterCtrl', GmapsImporterCtrl)
    .directive('tcEntityMarker', tcEntityMarker)
    .directive('tcEntityIcon', tcEntityIcon)
    .directive('tcSearchResultMarker', tcSearchResultMarker)
    .directive('tcSearchResultIcon', tcSearchResultIcon)
    .directive('tcUserIcon', tcUserIcon)
    .directive('tcAfterNewTripPlanPanel', tcAfterNewTripPlanPanel)
    .directive('tcEntityDetails', tcEntityDetails)
    .directive('tcTripPlanDetailsHeader', tcTripPlanDetailsHeader)
    .directive('tcTrackEntityDragState', tcTrackEntityDragState)
    .directive('tcDraggableEntitySummary', tcDraggableEntitySummary)
    .directive('tcFilterBar', tcFilterBar)
    .directive('tcSetNanoScrollbars', tcSetNanoScrollbars)
    .directive('tcLinkHeights', tcLinkHeights)
    .service('$templateToStringRenderer', TemplateToStringRenderer)
    .service('$dataRefreshManager', DataRefreshManager)
    .service('$mapManager', MapManager)
    .service('$sizeHelper', SizeHelper)
    .service('$entityCtrlProxy', EntityCtrlProxy)
    .service('$entityClippingService', EntityClippingService)
    .service('$entityEditingService', EntityEditingService)
    .service('$entityOrderingService', EntityOrderingService)
    .filter('creatorDisplayName', makeFilter(creatorDisplayName));

  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
