function hostnameFromUrl(url) {
  var fullHost = $('<a>').attr('href', url)[0].hostname;
  if (fullHost.substring(0, 4) == 'www.') {
    return fullHost.substring(4);
  }
  return fullHost;
}

function EntityModel(entityData, editable) {
  this.data = entityData;

  this.hasDescription = function() {
    return this.data['description'] && this.data['description'].length;
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

  this.marker = this.makeMarker();
  this.infowindow = null;
}

function TripPlanModel(tripPlanData) {
  this.data = tripPlanData;

  this.hasClippedPages = function() {
    return this.data['clipped_pages'] && this.data['clipped_pages'].length;
  };

  this.entitiesForCategory = function(category) {
    var entities = [];
    $.each(this.data['entities'], function(i, entity) {
      if (entity['category'] && entity['category']['category_id'] == category['category_id']) {
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

  this.isEmpty = function() {
    return this.data['entities'].length == 0;
  };
}

function CategoryCtrl($scope, $map, $mapBounds, $http, $tripPlanSettings, $allowEditing) {
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
    marker.setMap($map);
    $mapBounds.extend(marker.getPosition())
    google.maps.event.addListener(marker, 'click', function() {
      entityModel.makeInfowindow().open($map, marker);
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
    var editRequest = {
      'trip_plan_id_str': $tripPlanSettings['trip_plan_id_str'],
      'entity': entityData
    }
    $http.post('/editentity', editRequest).error(function() {
      alert('Failed to save new marker location');
    });
  };

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

function RootCtrl($scope, $http, $timeout, $modal, $tripPlan, $tripPlanSettings, $categories) {
  var me = this;
  $scope.pageStateModel = new PageStateModel();
  $scope.planModel = new TripPlanModel($tripPlan);
  $scope.orderedCategories = $categories;
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
          // Similarly, since the main iteration in the template is done
          // over 'orderedCategories', we must reset that variable
          // after a refresh for Angular to detect that it should re-iterate
          // over that part of the DOM.
          $scope.planModel = null;
          $scope.orderedCategories = null;
          $timeout(function() {
            $scope.planModel = newModel;
            $scope.orderedCategories = $categories;
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
  $scope.navigate = function(categoryName) {
    $location.hash(categoryName)
    $anchorScroll();
  };
}


function createMap() {
  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 2
  };
  return new google.maps.Map($('#map')[0], mapOptions);
}

function AccountDropdownCtrl($scope, $http, $accountInfo, $currentTripPlanSettings, $allTripPlansSettings) {
  $scope.accountInfo = $accountInfo;
  $scope.accountInfo.loggedIn = !!$accountInfo['email'];
  $scope.showLoginForm = !$scope.accountInfo.loggedIn;
  $scope.currentTripPlanSettings = $currentTripPlanSettings;
  $scope.allTripPlansSettings = $allTripPlansSettings;

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

  $scope.loadTripPlan = function(tripPlanIdStr) {
    location.href = '/trip_plan/' + tripPlanIdStr;
  };

  $scope.createNewTripPlan = function() {
    if (!$scope.accountInfo.loggedIn) {
      alert('Please log in before creating additional trip plans');
      return;
    }
    $http.post('/new_trip_plan_ajax', {})
      .success(function(response) {
        var newTripPlanIdStr = response['new_trip_plan_id_str'];
        $scope.loadTripPlan(newTripPlanIdStr)
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

function GuideViewCtrl($scope) {

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

window['initApp'] = function(tripPlan, tripPlanSettings, allTripPlansSettings, accountInfo, categories, allowEditing) {
  angular.module('initialDataModule', [])
    .value('$tripPlan', tripPlan)
    .value('$tripPlanSettings', tripPlanSettings)
    .value('$allTripPlansSettings', allTripPlansSettings)
    .value('$categories', categories)
    .value('$accountInfo', accountInfo)
    .value('$allowEditing', allowEditing);

  angular.module('mapModule', [])
    .value('$map', createMap())
    .value('$mapBounds', new google.maps.LatLngBounds());

  angular.module('directivesModule', [])
    .directive('tcScrollToOnClick', tcScrollToOnClick)
    .directive('tcStarRating', tcStarRating)
    .directive('bnLazySrc', bnLazySrc);

  angular.module('appModule', ['mapModule', 'initialDataModule', 'directivesModule', 'ui.bootstrap', 'wu.masonry'], function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');
  })
    .controller('RootCtrl', ['$scope', '$http', '$timeout', '$modal', '$tripPlan', '$tripPlanSettings', '$categories', RootCtrl])
    .controller('AccountDropdownCtrl', ['$scope', '$http', '$accountInfo', '$tripPlanSettings', '$allTripPlansSettings', AccountDropdownCtrl])
    .controller('CategoryCtrl', ['$scope', '$map', '$mapBounds', '$http', '$tripPlanSettings', '$allowEditing', CategoryCtrl])
    .controller('EntityCtrl', ['$scope', '$http', '$tripPlanSettings', EntityCtrl])
    .controller('ClippedPagesCtrl', ['$scope', ClippedPagesCtrl])
    .controller('NavigationCtrl', ['$scope', '$location', '$anchorScroll', NavigationCtrl])
    .controller('CarouselCtrl', ['$scope', CarouselCtrl])
    .controller('GuideViewCtrl', ['$scope', GuideViewCtrl])
    .controller('GuideViewCategoryCtrl', ['$scope', GuideViewCategoryCtrl])
    .controller('GuideViewCarouselCtrl', ['$scope', '$timeout', GuideViewCarouselCtrl])
    .filter('hostname', function() {
      return function(input) {
        return hostnameFromUrl(input);
      }
    });
  angular.element(document).ready(function() {
    angular.bootstrap(document, ['appModule']);
  });
};
