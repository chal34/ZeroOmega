angular.module('omega').controller('QuickSwitchCtrl', function($scope: any, $filter: any) {
  $scope.sortableOptions = {
    tolerance: 'pointer',
    axis: 'y',
    forceHelperSize: true,
    forcePlaceholderSize: true,
    connectWith: '.cycle-profile-container',
    containment: '#quick-switch-settings',
  };

  $scope.$watchCollection('options', function(options: any) {
    if (options == null) return;
    const allProfiles: any[] = $filter('profiles')(options, 'all');
    $scope.notCycledProfiles = allProfiles
      .filter(function(profile: any) {
        return options["-quickSwitchProfiles"].indexOf(profile.name) < 0;
      })
      .map(function(profile: any) { return profile.name; });
  });
});
