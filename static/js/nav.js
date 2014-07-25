// TODO:
// -Verify that the 'next' url is working properly when clicking the 'Join' link.

function NavCtrl($scope, $modal, $window) {
  $scope.openLoginModal = function(loginUrl, windowClass) {
    var scope = $scope.$new(true);
    scope.iframeUrl = loginUrl;
    var modal = $modal.open({
      templateUrl: 'login-modal-template',
      windowClass: windowClass,
      scope: scope
    });
    $window['closeLoginModal'] = function() {
      modal.close();
      $window['closeLoginModal'] = null;
    };
  };
}

function tcNav() {
  return {
    restrict: 'AE',
    controller: NavCtrl,
    templateUrl: 'nav-template',
    scope: {
      accountInfo: '=',
      activeTripPlan: '=',
      numEntities: '&',
      allTripPlans: '=',
      shoppingCartMode: '='
    }
  };
}

function tcAccountDropdown() {
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'account-dropdown-template'
  };
}

function tcNavTripPlanDropdown() {
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'nav-trip-plan-dropdown-template'
  };
}

angular.module('navModule', ['ui.bootstrap'])
  .directive('tcNav', tcNav)
  .directive('tcAccountDropdown', tcAccountDropdown)
  .directive('tcNavTripPlanDropdown', tcNavTripPlanDropdown);
