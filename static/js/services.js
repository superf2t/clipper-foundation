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
  this.saveNewEntity = function(entity, tripPlanIdStr, success, error) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.ADD)]
    };
    this.mutate(request, success, error);
  };

  this.editEntity = function(entity, tripPlanIdStr, success, error) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.EDIT)]
    };
    this.mutate(request, success, error);
  };

  this.deleteEntity = function(entity, tripPlanIdStr, success, error) {
    var request = {
      'operations': [this.operationFromEntity(entity, tripPlanIdStr, Operator.DELETE)]
    };
    this.mutate(request, success, error);
  };

  this.mutate = function(request, success, error) {
    $http.post('/entityservice/mutate', request)
      .success(success)
      .error(error);
    };

  this.operationFromEntity = function(entity, tripPlanIdStr, operator) {
    return {
      'operator': operator,
      'trip_plan_id_str': tripPlanIdStr,
      'entity': entity
    };
  }
}

angular.module('servicesModule', [])
  .service('$entityService', ['$http', EntityService]);
