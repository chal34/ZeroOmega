angular.module('omega').controller('BuiltinCtrl', function($scope: any, $stateParams: any,
  $location: any, $rootScope: any,
  $timeout: any, $state: any, $modal: any,
  builtinProfiles: any, profileColorPalette: any,
  getAttachedName: any, getParentName: any, getVirtualTarget: any,
  omegaTarget: any
) {

  const customBuiltinProfiles: any = {};

  const decorateBuiltinProfile = function(newOptions: any) {
    Object.assign(
      customBuiltinProfiles,
      builtinProfiles,
      newOptions?.['-builtinProfiles']
    );
    $scope.systemProfile = customBuiltinProfiles['+system'];
    $scope.directProfile = customBuiltinProfiles['+direct'];
  };

  omegaTarget.addOptionsChangeCallback(decorateBuiltinProfile);

  decorateBuiltinProfile($rootScope.options);
  $scope.moveColor = function(color: any, key: any) {
    customBuiltinProfiles[key].color = color;
    // make sure options watcher watch value changed
    $rootScope.options['-builtinProfiles'] =
      JSON.parse(JSON.stringify(customBuiltinProfiles));
  };
  $scope.changeColor = function(color: any) {
    console.log('change color::::', color);
  };
  $scope.spectrumOptions = {
    localStorageKey: 'spectrum.profileColor',
    palette: profileColorPalette,
    preferredFormat: 'hex',
    showButtons: false,
    showInitial: true,
    showInput: true,
    showPalette: true,
    showAlpha: true,
    showSelectionPalette: true,
    maxSelectionSize: 5,
  };
});
