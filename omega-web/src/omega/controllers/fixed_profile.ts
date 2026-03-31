angular.module('omega').controller('FixedProfileCtrl', function($scope: any, $modal: any,
  trFilter: any) {
  $scope.urlSchemes = ['', 'http', 'https', 'ftp'];
  $scope.urlSchemeDefault = 'fallbackProxy';
  const proxyProperties: any = {
    '': 'fallbackProxy',
    'http': 'proxyForHttp',
    'https': 'proxyForHttps',
    'ftp': 'proxyForFtp',
  };
  $scope.schemeDisp = {
    '': null,
    'http': 'http://',
    'https': 'https://',
    'ftp': 'ftp://',
  };

  const defaultPort: any = {
    'http': 80,
    'https': 443,
    'socks4': 1080,
    'socks5': 1080,
  };

  $scope.showAdvanced = false;

  $scope.optionsForScheme = {} as any;
  for (const scheme of $scope.urlSchemes) {
    const defaultLabel = scheme
      ? trFilter('options_protocol_useDefault')
      : trFilter('options_protocol_direct');
    $scope.optionsForScheme[scheme] = [
      {label: defaultLabel, value: undefined},
      {label: 'HTTP', value: 'http'},
      {label: 'HTTPS', value: 'https'},
      {label: 'SOCKS4', value: 'socks4'},
      {label: 'SOCKS5', value: 'socks5'},
    ];
  }

  $scope.proxyEditors = {};

  const socks5AuthSupported = !!(browser?.proxy?.onRequest);
  $scope.authSupported = {
    "http": true,
    "https": true,
    "socks5": socks5AuthSupported,
  };
  $scope.isProxyAuthActive = function(scheme: any) {
    return $scope.profile.auth?.[proxyProperties[scheme]] != null;
  };
  $scope.editProxyAuth = function(scheme: any) {
    const prop = proxyProperties[scheme];
    const proxy = $scope.profile[prop];
    const scope = $scope.$new('isolate');
    scope.proxy = proxy;
    const auth = $scope.profile.auth?.[prop];
    scope.auth = auth && angular.copy(auth);
    scope.authSupported = $scope.authSupported[proxy.scheme];
    scope.protocolDisp = proxy.scheme;
    $modal.open({
      templateUrl: 'partials/fixed_auth_edit.html',
      scope: scope,
      size: scope.authSupported ? 'sm' : 'lg',
    }).result.then(function(auth: any) {
      if (!auth?.username) {
        if ($scope.profile.auth) {
          $scope.profile.auth[prop] = undefined;
        }
      } else {
        $scope.profile.auth = $scope.profile.auth ?? {};
        $scope.profile.auth[prop] = auth;
      }
    });
  };

  const onProxyChange = function(proxyEditors: any, oldProxyEditors: any) {
    if (!proxyEditors) return;
    for (const scheme of $scope.urlSchemes) {
      const proxy = proxyEditors[scheme];
      if (!proxy.scheme) {
        if (!scheme) {
          proxyEditors[scheme] = {};
        }
        delete $scope.profile[proxyProperties[scheme]];
        continue;
      } else if (!oldProxyEditors[scheme].scheme) {
        if (proxy.scheme === proxyEditors[''].scheme) {
          proxy.port = proxy.port ?? proxyEditors[''].port;
        }
        proxy.port = proxy.port ?? defaultPort[proxy.scheme];
        proxy.host = proxy.host ?? proxyEditors[''].host ?? 'example.com';
      }
      $scope.profile[proxyProperties[scheme]] = $scope.profile[proxyProperties[scheme]] ?? proxy;
    }
  };
  for (const scheme of $scope.urlSchemes) {
    ((scheme: any) => {
      $scope.$watch(function() { return $scope.profile[proxyProperties[scheme]]; }, function(proxy: any) {
        if (scheme && proxy) {
          $scope.showAdvanced = true;
        }
        $scope.proxyEditors[scheme] = proxy ?? {};
      });
    })(scheme);
  }
  $scope.$watch('proxyEditors', onProxyChange, true);

  const onBypassListChange = function(list: any) {
    $scope.bypassList = list.map(function(item: any) { return item.pattern; }).join('\n');
  };

  $scope.$watch('profile.bypassList', onBypassListChange, true);

  $scope.$watch('bypassList', function(bypassList: any, oldList: any) {
    if (bypassList == null || bypassList === oldList) return;
    $scope.profile.bypassList = bypassList.split(/\r?\n/).filter(function(entry: any) { return entry; }).map(function(entry: any) {
      return {
        conditionType: "BypassCondition",
        pattern: entry,
      };
    });
  });
});
