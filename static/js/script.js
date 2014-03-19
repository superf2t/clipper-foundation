function init(tripPlan) {
  window['_globalState'] = new GlobalState();
  drawMap(tripPlan['entities']);
}

function drawMap(entities) {
  var mapOptions = {
    center: new google.maps.LatLng(-25.363882,131.044922),
    zoom: 8
  };
  var map = new google.maps.Map($('#map')[0], mapOptions);
  globalState().map = map;
  var bounds = new google.maps.LatLngBounds();

  $.each(entities, function(i, entity) {
    var latlng = new google.maps.LatLng(entity['latlng']['lat'], entity['latlng']['lng']);
    var entityName = entity['name'];
    var markerData = {
      position: latlng,
      map: map,
      title: entityName
      //icon: '/static/img/' + entity['icon_url']
    };
    console.log(entity);
    if (entity['address_precision'] == 'Imprecise') {
      markerData.icon = '/static/img/circle_marker.png'
    }
    var marker = new google.maps.Marker(markerData);
    bounds.extend(latlng);

    var infowindowContent = '<b>' + entityName + '</b>';

    var infowindow = new google.maps.InfoWindow({content: infowindowContent});
    google.maps.event.addListener(marker, 'click', function() {
      infowindow.open(map, marker);
    });

    globalState().addEntity(entity, marker, infowindow);
  });

  map.fitBounds(bounds);
}

function GlobalState() {
  this.infowindowsByEntityName = {};
  this.markersByEntityName = {};
  this.entitiesByName = {};
  this.sectionStates = {};
  this.map = null;

  this.addEntity = function(entity, marker, infowindow) {
    this.infowindowsByEntityName[entity['name']] = infowindow;
    this.markersByEntityName[entity['name']] = marker;
    this.entitiesByName[entity['name']] = entity;
  };

  this.closeAllInfowindows = function() {
    $.each(this.infowindowsByEntityName, function(name, infowindow) {
      infowindow.close();
    });
  };

  this.openInfowindow = function(entityName) {
    this.infowindowsByEntityName[entityName].open(
      this.map, this.markersByEntityName[entityName]);
  };

  this.toggleSection = function(elem, entityType) {
    var show = this.sectionStates[entityType] = !this.sectionStates[entityType];
    this.closeAllInfowindows();
    var me = this;
    if (show) {
      $(elem).parent().find('.one-entity').show();
      $.each(this.markersByEntityName, function(name, marker) {
        if (me.entitiesByName[name]['entity_type'] == entityType) {
          marker.setMap(me.map);
        }
      });
    } else {
      $(elem).parent().find('.one-entity').hide();
      $.each(this.markersByEntityName, function(name, marker) {
        if (me.entitiesByName[name]['entity_type'] == entityType) {
          marker.setMap(null);
        }
      });
    }
  }
}

function openInfowindow(entityName) {
  globalState().closeAllInfowindows();
  globalState().openInfowindow(entityName);
}

function toggleSection(elem, entityType) {
  globalState().toggleSection(elem, entityType);
}

function globalState() {
  return window['_globalState'];
}

