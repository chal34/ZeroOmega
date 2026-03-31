angular.module('omega').controller('AboutCtrl', function(
  $scope: any, $rootScope: any, $modal: any, omegaDebug: any
) {
  $scope.downloadLog = function() {
    $scope.logDownloading = true;
    Promise.resolve(omegaDebug.downloadLog()).then(function() {
      $scope.logDownloading = false;
    });
  };
  $scope.reportIssue = function() {
    $scope.issueReporting = true;
    omegaDebug.reportIssue().then(function() {
      $scope.issueReporting = false;
    });
  };

  $scope.showResetOptionsModal = function() {
    $modal
      .open({templateUrl: 'partials/reset_options_confirm.html'}).result
      .then(function() {
        $scope.optionsReseting = true;
        omegaDebug.resetOptions().then(function() {
          $scope.optionsReseting = false;
        });
      });
  };

  try {
    $scope.version = omegaDebug.getProjectVersion();
  } catch (_) {
    $scope.version = '?.?.?';
  }
});
