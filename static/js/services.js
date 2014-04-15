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

  this.editEntity = function(entity, tripPlanId) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanId, Operator.EDIT)]
    };
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
  }

  this.googleplacetoentity = function(reference) {
    var request = {'reference': reference};
    return $http.post('/entityservice/googleplacetoentity', request)
  };

  this.urltoentity = function(url) {
    var request = {'url': url};
    return $http.post('/entityservice/urltoentity', request);
  };

  this.pagesourcetoentity = function(url, pageSource) {
    var request = {
      'url': url,
      'page_source': pageSource
    };
    return $http.post('/entityservice/pagesourcetoentity', request);
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
}


angular.module('servicesModule', [])
  .service('$entityService', ['$http', EntityService])
  .service('$tripPlanService', ['$http', TripPlanService]);
