angular.module('omega').controller('ProfileCtrl', function($scope: any, $stateParams: any,
  $location: any, $rootScope: any, $timeout: any, $state: any, $modal: any, profileColorPalette: any,
  getAttachedName: any, getParentName: any, getVirtualTarget: any) {
  const name = $stateParams.name;
  const profileTemplates: any = {
    'FixedProfile': 'profile_fixed.html',
    'PacProfile': 'profile_pac.html',
    'VirtualProfile': 'profile_virtual.html',
    'SwitchProfile': 'profile_switch.html',
    'RuleListProfile': 'profile_rule_list.html',
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

  $scope.getProfileColor = function() {
    let color: any = undefined;
    let profile = $scope.profile;
    while (profile) {
      color = profile.color;
      profile = getVirtualTarget(profile, $scope.options);
    }
    return color;
  };

  $scope.deleteProfile = function() {
    const profileName = $scope.profile.name;
    const refs = OmegaPac.Profiles.referencedBySet(profileName, $rootScope.options);

    const scope = $rootScope.$new('isolate');
    scope.profile = $scope.profile;
    scope.dispNameFilter = $scope.dispNameFilter;
    scope.options = $scope.options;

    if (Object.keys(refs).length > 0) {
      const refSet: any = {};
      for (const key in refs) {
        if (refs.hasOwnProperty(key)) {
          let pname = refs[key];
          const parent = getParentName(pname);
          if (parent) {
            const parentKey = OmegaPac.Profiles.nameAsKey(parent);
            refSet[parentKey] = parent;
          } else {
            refSet[key] = pname;
          }
        }
      }

      const refProfiles: any[] = [];
      for (const key in refSet) {
        if (refSet.hasOwnProperty(key)) {
          refProfiles.push(OmegaPac.Profiles.byKey(key, $rootScope.options));
        }
      }
      scope.refs = refProfiles;
      $modal.open({
        templateUrl: 'partials/cannot_delete_profile.html',
        scope: scope,
      });
      return;
    } else {
      $modal.open({
        templateUrl: 'partials/delete_profile.html',
        scope: scope,
      }).result.then(function() {
        const attachedName = getAttachedName(profileName);
        delete $rootScope.options[OmegaPac.Profiles.nameAsKey(attachedName)];
        delete $rootScope.options[OmegaPac.Profiles.nameAsKey(profileName)];
        if ($rootScope.options['-startupProfileName'] === profileName) {
          $rootScope.options['-startupProfileName'] = "";
        }
        const quickSwitch = $rootScope.options['-quickSwitchProfiles'];
        for (let i = 0; i < quickSwitch.length; i++) {
          if (profileName === quickSwitch[i]) {
            quickSwitch.splice(i, 1);
            break;
          }
        }
        $state.go('ui');
      });
    }
  };

  // The watcher should be applied on the calling scope.
  $scope.watchAndUpdateRevision = function(this: any, expression: any) {
    let revisionChanged = false;
    const onChange = function(profile: any, oldProfile: any) {
      if (profile === oldProfile || !profile || !oldProfile) return profile;
      if (revisionChanged && profile.revision !== oldProfile.revision) {
        revisionChanged = false;
      } else {
        OmegaPac.Profiles.updateRevision(profile);
        revisionChanged = true;
      }
    };
    this.$watch(expression, onChange, true);
  };

  $scope.exportRuleList = null;
  $scope.exportRuleListOptions = null;
  $scope.setExportRuleListHandler = function(exportRuleList: any, options: any) {
    $scope.exportRuleList = exportRuleList;
    $scope.exportRuleListOptions = options;
  };

  const unwatch = $scope.$watch(function() { return $scope.options?.['+' + name]; }, function(profile: any) {
    if (!profile) {
      if ($scope.options) {
        unwatch();
        $location.path('/');
      } else {
        const unwatch2 = $scope.$watch('options', function() {
          if ($scope.options) {
            unwatch2();
            if (!$scope.options['+' + name]) {
              unwatch();
              $location.path('/');
            }
          }
        });
      }
      return;
    }
    if (OmegaPac.Profiles.formatByType[profile.profileType]) {
      profile.format = OmegaPac.Profiles.formatByType[profile.profileType];
      profile.profileType = 'RuleListProfile';
    }
    $scope.profile = profile;
    const type = $scope.profile.profileType;
    const templ = profileTemplates[type] ?? 'profile_unsupported.html';
    $scope.profileTemplate = 'partials/' + templ;
    $scope.scriptable = true;

    $scope.watchAndUpdateRevision('profile');
  });
});
