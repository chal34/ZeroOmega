angular.module('omega').constant('builtinProfiles',
  OmegaPac.Profiles.builtinProfiles);

const profileColors = [
  '#9ce', '#9d9', '#fa8', '#fe9', '#d497ee', '#47b', '#5b5', '#d63', '#ca0',
];
const colors = ([] as string[]).concat(profileColors);
const profileColorPalette: string[][] = [];
while (colors.length) {
  profileColorPalette.push(colors.splice(0, 3));
}

angular.module('omega').constant('profileColors', profileColors);
angular.module('omega').constant('profileColorPalette', profileColorPalette);

const attachedPrefix = '__ruleListOf_';
angular.module('omega').constant('getAttachedName', function(name: any) {
  return attachedPrefix + name;
});
angular.module('omega').constant('getParentName', function(name: any) {
  if (name.indexOf(attachedPrefix) === 0) {
    return name.substr(attachedPrefix.length);
  } else {
    return undefined;
  }
});

const charCodeUnderscore = '_'.charCodeAt(0);
angular.module('omega').constant('charCodeUnderscore', charCodeUnderscore);
angular.module('omega').constant('isProfileNameHidden', function(name: any) {
  // Hide profiles beginning with underscore.
  return name.charCodeAt(0) === charCodeUnderscore;
});
angular.module('omega').constant('isProfileNameReserved', function(name: any) {
  // Reserve profile names beginning with double-underscore.
  return (name.charCodeAt(0) === charCodeUnderscore &&
    name.charCodeAt(1) === charCodeUnderscore);
});

angular.module('omega').config(function($stateProvider: any, $urlRouterProvider: any,
  $httpProvider: any, $animateProvider: any, $compileProvider: any) {
  $compileProvider.aHrefSanitizationWhitelist(
    /^\s*(https?|ftp|mailto|chrome-extension|moz-extension):/);
  $compileProvider.imgSrcSanitizationWhitelist(
    /^\s*(https?|local|data|chrome-extension|moz-extension):/);
  $animateProvider.classNameFilter(/angular-animate/);

  $urlRouterProvider.otherwise('/about');

  $urlRouterProvider.otherwise(function($injector: any, $location: any) {
    if ($location.path() === '') {
      return $injector.get('omegaTarget').lastUrl() || '/about';
    } else {
      return '/about';
    }
  });

  $stateProvider
    .state('ui', {
      url: '/ui',
      templateUrl: 'partials/ui.html',
      //controller: 'UiCtrl'
    }).state('general', {
      url: '/general',
      templateUrl: 'partials/general.html',
      //controller: 'GeneralCtrl'
    }).state('io', {
      url: '/io',
      templateUrl: 'partials/io.html',
      controller: 'IoCtrl',
    }).state('builtin', {
      url: '/builtin',
      templateUrl: 'partials/builtin.html',
      controller: 'BuiltinCtrl',
    }).state('theme', {
      url: '/theme',
      templateUrl: 'partials/theme.html',
    }).state('profile', {
      url: '/profile/*name',
      templateUrl: 'partials/profile.html',
      controller: 'ProfileCtrl',
    }).state('about', {
      url: '/about',
      templateUrl: 'partials/about.html',
      controller: 'AboutCtrl',
    });
});

angular.module('omega').factory('$exceptionHandler', function($log: any) {
  return function(exception: any, cause: any) {
    if (exception.message === 'transition aborted') return;
    if (exception.message === 'transition superseded') return;
    if (exception.message === 'transition prevented') return;
    if (exception.message === 'transition failed') return;
    $log.error(exception, cause);
  };
});

angular.module('omega').factory('omegaDebug', function($window: any, $rootScope: any,
  $injector: any) {
  const omegaDebug: any = $window.OmegaDebug ?? {};

  omegaDebug.downloadLog = omegaDebug.downloadLog ?? function() {
    const downloadFile = $injector.get('downloadFile') ?? saveAs;
    const blob = new Blob([localStorage['log']], {type: "text/plain;charset=utf-8"});
    downloadFile(blob, `OmegaLog_${Date.now()}.txt`);
  };

  omegaDebug.reportIssue = omegaDebug.reportIssue ?? function() {
    $window.open(
      'https://github.com/FelisCatus/SwitchyOmega/issues/new?title=&body=');
    return;
  };

  omegaDebug.resetOptions = omegaDebug.resetOptions ?? function() {
    return $rootScope.resetOptions();
  };

  return omegaDebug;
});

angular.module('omega').factory('downloadFile', function() {
  return function(blob: any, filename: any) {
    const noAutoBom = true;
    saveAs(blob, filename, noAutoBom);
  };
});
