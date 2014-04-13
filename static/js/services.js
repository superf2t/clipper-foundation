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
  this.saveNewEntity = function(entity, tripPlanIdStr) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.ADD)]
    };
    return this.mutate(request);
  };

  this.editEntity = function(entity, tripPlanIdStr) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.EDIT)]
    };
    return this.mutate(request);
  };

  this.deleteEntity = function(entity, tripPlanIdStr) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.DELETE)]
    };
    return this.mutate(request);
  };

  this.mutate = function(request) {
    return $http.post('/entityservice/mutate', request);
  };

  this.operationFromEntity = function(entity, tripPlanIdStr, operator) {
    return {
      'operator': operator,
      'trip_plan_id_str': tripPlanIdStr,
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

angular.module('servicesModule', [])
  .service('$entityService', ['$http', EntityService]);
