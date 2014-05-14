var ResponseCode = {
  SUCCESS: 'SUCCESS',
  SERVER_ERROR: 'SERVER_ERROR',
  REQUEST_ERROR: 'REQUEST_ERROR'
};

var Operator = {
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE'
};

var CommonError = {
  NOT_AUTHORIZED_FOR_OPERATION: 'NOT_AUTHORIZED_FOR_OPERATION'
}

function extractError(response, errorCode) {
  return _.find(response['errors'], function(error) {
    return error['error_code'] == errorCode;
  });
}

function EntityService($http) {
  this.getByTripPlanId = function(tripPlanId, opt_lastModifiedTime) {
    var request = {
      'trip_plan_id': tripPlanId,
      'if_modified_after': opt_lastModifiedTime
    };
    return $http.post('/entityservice/get', request);
  };

  this.saveNewEntity = function(entity, tripPlanId) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanId, Operator.ADD)]
    };
    return this.mutate(request);
  };

  this.saveNewEntities = function(entities, tripPlanId) {
    var me = this;
    var operations = _.map(entities, function(entity) {
      return me.operationFromEntity(entity, tripPlanId, Operator.ADD);
    });
    var request = {'operations': operations};
    return this.mutate(request);
  };

  this.editEntity = function(entity, tripPlanId) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanId, Operator.EDIT)]
    };
    return this.mutate(request);
  };

  this.editEntities = function(entities, tripPlanId) {
    var me = this;
    var operations = _.map(entities, function(entity) {
      return me.operationFromEntity(entity, tripPlanId, Operator.EDIT);
    });
    var request = {'operations': operations};
    return this.mutate(request);
  };

  this.deleteEntity = function(entity, tripPlanId) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanId, Operator.DELETE)]
    };
    return this.mutate(request);
  };

  this.mutate = function(request) {
    return $http.post('/entityservice/mutate', request);
  };

  this.operationFromEntity = function(entity, tripPlanId, operator) {
    return {
      'operator': operator,
      'trip_plan_id': tripPlanId,
      'entity': entity
    };
  };

  this.googleplacetoentity = function(reference) {
    var request = {'reference': reference};
    return $http.post('/entityservice/googleplacetoentity', request)
  };

  this.urltoentities = function(url) {
    var request = {'url': url};
    return $http.post('/entityservice/urltoentities', request);
  };

  this.pagesourcetoentities = function(url, pageSource) {
    var request = {
      'url': url,
      'page_source': pageSource
    };
    return $http.post('/entityservice/pagesourcetoentities', request);
  };

  this.googletextsearchtoentities = function(query, latlng) {
    var request = {
      'query': query,
      'latlng': latlng,
      'max_results': 5
    };
    return $http.post('/entityservice/googletextsearchtoentities', request);
  };
}


function TripPlanService($http) {
  this.getById = function(tripPlanId) {
    var request = {'trip_plan_ids': [tripPlanId]};
    return $http.post('/tripplanservice/get', request);
  };

  this.saveNewTripPlan = function(tripPlan) {
    var request = {
      'operations': [this.operationFromTripPlan(tripPlan, Operator.ADD)]
    };
    return this.mutate(request);
  };

  this.editTripPlan = function(tripPlan) {
    var request = {
      'operations': [this.operationFromTripPlan(tripPlan, Operator.EDIT)]
    };
    return this.mutate(request);
  };

  this.deleteTripPlanById = function(tripPlanId) {
    var tripPlan = {'trip_plan_id': tripPlanId};
    var request = {
      'operations': [this.operationFromTripPlan(tripPlan, Operator.DELETE)]
    };
    return this.mutate(request);
  };

  this.mutate = function(request) {
    return $http.post('/tripplanservice/mutate', request);
  };

  this.operationFromTripPlan = function(tripPlan, operator) {
    return {
      'operator': operator,
      'trip_plan': tripPlan
    };
  };

  this.cloneTripPlan = function(tripPlanId) {
    var request = {'trip_plan_id': tripPlanId};
    return $http.post('/tripplanservice/clone', request);
  };

  this.gmapsimport = function(url) {
    var request = {'gmaps_url': url};
    return $http.post('/tripplanservice/gmapsimport', request);
  }
}

var TripPlanServiceError = {
  INVALID_GOOGLE_MAPS_URL: 'INVALID_GOOGLE_MAPS_URL'
};

function NoteService($http) {
  this.getByTripPlanId = function(tripPlanId, opt_lastModifiedTime) {
    var request = {
      'trip_plan_id': tripPlanId,
      'if_modified_after': opt_lastModifiedTime
    };
    return $http.post('/noteservice/get', request);
  };

  this.saveNewNote = function(note, tripPlanId) {
    var request = {
      'operations': [this.operationFromNote(note, tripPlanId, Operator.ADD)]
    };
    return this.mutate(request);
  };

  this.editNote = function(note, tripPlanId) {
    var request = {
      'operations': [this.operationFromNote(note, tripPlanId, Operator.EDIT)]
    };
    return this.mutate(request);
  };

  this.deleteNote = function(note, tripPlanId) {
    var request = {
      'operations': [this.operationFromNote(note, tripPlanId, Operator.DELETE)]
    };
    return this.mutate(request);
  };

  this.mutate = function(request) {
    return $http.post('/noteservice/mutate', request);
  };

  this.operationFromNote = function(note, tripPlanId, operator) {
    return {
      'operator': operator,
      'trip_plan_id': tripPlanId,
      'note': note
    };
  };
}

function AccountService($http) {
  this.loginAndMigrate = function(email) {
    var request = {
      'email': email
    };
    return $http.post('/accountservice/loginandmigrate', request);
  };
}

var AccountServiceError = {
  INVALID_EMAIL: 'INVALID_EMAIL'
};

angular.module('servicesModule', [])
  .service('$entityService', ['$http', EntityService])
  .service('$noteService', ['$http', NoteService])
  .service('$tripPlanService', ['$http', TripPlanService])
  .service('$accountService', ['$http', AccountService]);
