angular.module('omega').controller('IoCtrl', function(
  $scope: any, $rootScope: any, $window: any, $http: any, omegaTarget: any, downloadFile: any
) {

  $scope.useBuiltInSync = true;
  const getGistId = function(gistUrl: string = '') {
    // get gistId from url `https://gist.github.com/{username}/{gistId}`
    // or directly gistId
    let gistId = gistUrl.replace(/\/+$/, '');
    const parts = gistId.split('/');
    gistId = parts[parts.length - 1];
    return gistId;
  };

  omegaTarget.state([
    'web.restoreOnlineUrl',
    'gistId',
    'gistToken',
    'lastGistSync',
    'lastGistState',
  ]).then(function([url, gistId, gistToken, lastGistSync, lastGistState]: any[]) {
    if (url) {
      $scope.restoreOnlineUrl = url;
    }
    if (gistId) {
      $scope.gistId = gistId;
      $scope.gistUrl = "https://gist.github.com/" + getGistId(gistId);
    }
    if (gistToken) {
      $scope.gistToken = gistToken;
    }
    $scope.lastGistSync = new Date(lastGistSync || Date.now());
    $scope.lastGistState = lastGistState || '';
  });

  $scope.exportOptions = function() {
    $rootScope.applyOptionsConfirm().then(function() {
      const plainOptions = angular.fromJson(angular.toJson($rootScope.options));
      const content = JSON.stringify(plainOptions);
      const blob = new Blob([content], {type: "text/plain;charset=utf-8"});
      const filename = `ZeroOmegaOptions-${new Date().toISOString()}.bak`;
      downloadFile(blob, filename);
    });
  };

  $scope.importSuccess = function() {
    $rootScope.showAlert({
      type: 'success',
      i18n: 'options_importSuccess',
      message: 'Options imported.',
    });
  };

  $scope.restoreLocal = function(content: any) {
    $scope.restoringLocal = true;
    $rootScope.resetOptions(content).then((function() {
      $scope.importSuccess();
    }), function() { $scope.restoreLocalError(); }).finally(function() {
      $scope.restoringLocal = false;
    });
  };

  $scope.restoreLocalError = function() {
    $rootScope.showAlert({
      type: 'error',
      i18n: 'options_importFormatError',
      message: 'Invalid backup file!',
    });
  };
  $scope.downloadError = function() {
    $rootScope.showAlert({
      type: 'error',
      i18n: 'options_importDownloadError',
      message: 'Error downloading backup file!',
    });
  };
  $scope.triggerFileInput = function() {
    angular.element('#restore-local-file').click();
    return;
  };
  $scope.restoreOnline = function() {
    omegaTarget.state('web.restoreOnlineUrl', $scope.restoreOnlineUrl);
    $scope.restoringOnline = true;
    $http({
      method: 'GET',
      url: $scope.restoreOnlineUrl,
      cache: false,
      timeout: 10000,
      responseType: "text",
    }).then((function(result: any) {
      $rootScope.resetOptions(result.data).then(function() {
        $scope.importSuccess();
      }, function() { $scope.restoreLocalError(); });
    }), $scope.downloadError).finally(function() {
      $scope.restoringOnline = false;
    });
  };

  $scope.enableOptionsSync = function(args: any = {}) {
    const enable = function() {
      if (!$scope.gistId || !$scope.gistToken) {
        $rootScope.showAlert({
          type: 'error',
          message: 'Gist Id or Gist Token is required',
        });
        return;
      }
      args.gistId = $scope.gistId;
      args.gistToken = $scope.gistToken;
      args.useBuiltInSync = $scope.useBuiltInSync;
      $scope.enableOptionsSyncing = true;
      omegaTarget.setOptionsSync(true, args).then(function() {
        $window.location.reload();
      }).catch(function(e: any) {
        $scope.enableOptionsSyncing = false;
        $rootScope.showAlert({
          type: 'error',
          message: e + '',
        });
        console.log('error:::', e);
      });
    };
    if (args?.force) {
      enable();
    } else {
      $rootScope.applyOptionsConfirm().then(enable);
    }
  };

  $scope.cleanInput = function(target: any) {
    $scope[target] = '';
    omegaTarget.state(target, '');
  };

  $scope.checkOptionsSyncChange = function() {
    $scope.enableOptionsSyncing = true;
    omegaTarget.checkOptionsSyncChange().then(function() {
      $window.location.reload();
    });
  };
  $scope.disableOptionsSync = function() {
    omegaTarget.setOptionsSync(false).then(function() {
      $rootScope.applyOptionsConfirm().then(function() {
        $window.location.reload();
      });
    });
  };

  $scope.resetOptionsSync = function() {
    if (!$scope.gistId || !$scope.gistToken) {
      $rootScope.showAlert({
        type: 'error',
        message: 'Gist Id or Gist Token is required',
      });
      return;
    }
    omegaTarget.resetOptionsSync({
      gistId: $scope.gistId,
      gistToken: $scope.gistToken,
    }).then(function() {
      $rootScope.applyOptionsConfirm().then(function() {
        $window.location.reload();
      });
    }).catch(function(e: any) {
      $rootScope.showAlert({
        type: 'error',
        message: e + '',
      });
      console.log('error:::', e);
    });
  };
});
