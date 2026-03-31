angular.module('omega').controller('MasterCtrl', function($scope: any, $rootScope: any, $window: any,
  $q: any, $modal: any, $state: any, profileColors: any, profileIcons: any, omegaTarget: any,
  $timeout: any, $location: any, $filter: any, getAttachedName: any, isProfileNameReserved: any,
  isProfileNameHidden: any, dispNameFilter: any, downloadFile: any, themes: any
) {

  if (browser?.proxy?.register || browser?.proxy?.registerProxyScript) {
    $scope.isExperimental = true;
    $scope.pacProfilesUnsupported = true;
  }

  const tr = $filter('tr');

  $rootScope.options = null;

  omegaTarget.state('customCss').then(function(customCss: any) {
    if (customCss == null) customCss = '';
    $scope.customCss = customCss;
  });

  omegaTarget.addOptionsChangeCallback(function(newOptions: any) {
    $rootScope.options = angular.copy(newOptions);
    $rootScope.optionsOld = angular.copy(newOptions);

    omegaTarget.state('syncOptions').then(function(syncOptions: any) {
      $scope.syncOptions = syncOptions;
    });

    $timeout(function() {
      $rootScope.optionsDirty = false;
      showFirstRun();
    });
  });

  $rootScope.revertOptions = function() {
    if ($rootScope.optionsDirty) {
      $window.location.reload();
    }
  };

  $rootScope.exportScript = function(event: any, name: any) {
    $window.FORCEFIXEXPORTSCRIPTFORSOCKS = !!event.shiftKey;
    const getProfileName = name
      ? $q.when(name)
      : omegaTarget.state('currentProfileName');

    getProfileName.then(function(profileName: any) {
      if (!profileName) return;
      const profile = $rootScope.profileByName(profileName);
      if (['DirectProfile', 'SystemProfile'].indexOf(profile.profileType) >= 0) return;
      let missingProfile: any = null;
      const profileNotFound = function(name: any) {
        missingProfile = name;
        return 'dumb';
      };
      const ast = OmegaPac.PacGenerator.script($rootScope.options, profileName, {
        profileNotFound: profileNotFound,
      });
      let pac = ast.print_to_string({beautify: true, comments: true});
      pac = OmegaPac.PacGenerator.ascii(pac);
      const blob = new Blob([pac], {type: "text/plain;charset=utf-8"});
      const fileName = profileName.replace(/\W+/g, '_');
      downloadFile(blob, `OmegaProfile_${fileName}.pac`);
      if (missingProfile) {
        $timeout(function() {
          $rootScope.showAlert({
            type: 'error',
            message: tr('options_profileNotFound', [missingProfile]),
          });
        });
      }
    });
  };

  const diff = jsondiffpatch.create({
    objectHash: function(obj: any) { return JSON.stringify(obj); },
    textDiff: {minLength: 1 / 0},
  });

  $rootScope.showAlert = function(alert: any) { return $timeout(function() {
    $scope.alert = alert;
    $scope.alertShown = true;
    $scope.alertShownAt = Date.now();
    $timeout($rootScope.hideAlert, 3000);
    return;
  }); };

  $rootScope.hideAlert = function() { return $timeout(function() {
    if (Date.now() - $scope.alertShownAt >= 1000) {
      $scope.alertShown = false;
    }
  }); };

  const checkFormValid = function() {
    const fields = angular.element('.ng-invalid');
    if (fields.length > 0) {
      fields[0].focus();
      $rootScope.showAlert({
        type: 'error',
        i18n: 'options_formInvalid',
      });
      return false;
    }
    return true;
  };

  $rootScope.applyOptions = function() {
    if (!$rootScope.optionsDirty) return;
    if (!checkFormValid()) return;
    if ($rootScope.$broadcast('omegaApplyOptions').defaultPrevented) return;
    const plainOptions = angular.fromJson(angular.toJson($rootScope.options));
    const patch = diff.diff($rootScope.optionsOld, plainOptions);
    omegaTarget.optionsPatch(patch).then(function() {
      $rootScope.showAlert({
        type: 'success',
        i18n: 'options_saveSuccess',
      });
    });
  };

  $rootScope.resetOptions = function(options: any) {
    return omegaTarget.resetOptions(options).then(function() {
      $rootScope.showAlert({
        type: 'success',
        i18n: 'options_resetSuccess',
      });
    }).catch(function(err: any) {
      $rootScope.showAlert({
        type: 'error',
        message: err,
      });
      return $q.reject(err);
    });
  };

  $rootScope.profileByName = function(name: any) {
    return OmegaPac.Profiles.byName(name, $rootScope.options);
  };

  $rootScope.systemProfile = $rootScope.profileByName('system');
  $rootScope.externalProfile = {
    color: '#49afcd',
    name: tr('popup_externalProfile'),
    profileType: 'FixedProfile',
    fallbackProxy: {host: "127.0.0.1", port: 42, scheme: "http"},
  };

  $rootScope.applyOptionsConfirm = function() {
    if (!checkFormValid()) return $q.reject('form_invalid');
    if (!$rootScope.optionsDirty) return $q.when(true);
    return $modal.open({templateUrl: 'partials/apply_options_confirm.html'}).result
      .then(function() { return $rootScope.applyOptions(); });
  };

  $rootScope.newProfile = function() {
    const scope = $rootScope.$new('isolate');
    scope.options = $rootScope.options;
    scope.isProfileNameReserved = isProfileNameReserved;
    scope.isProfileNameHidden = isProfileNameHidden;
    scope.profileByName = $rootScope.profileByName;
    scope.validateProfileName = {
      conflict: '!$value || !profileByName($value)',
      reserved: '!$value || !isProfileNameReserved($value)',
    };
    scope.profileIcons = profileIcons;
    scope.dispNameFilter = dispNameFilter;
    scope.options = $scope.options;
    scope.pacProfilesUnsupported = $scope.pacProfilesUnsupported;
    $modal.open({
      templateUrl: 'partials/new_profile.html',
      scope: scope,
    }).result.then(function(profile: any) {
      profile = OmegaPac.Profiles.create(profile);
      const choice = Math.floor(Math.random() * profileColors.length);
      profile.color = profile.color ?? profileColors[choice];
      OmegaPac.Profiles.updateRevision(profile);
      $rootScope.options[OmegaPac.Profiles.nameAsKey(profile)] = profile;
      $state.go('profile', {name: profile.name});
    });
  };

  $rootScope.replaceProfile = function(fromName: any, toName: any) {
    $rootScope.applyOptionsConfirm().then(function() {
      const scope = $rootScope.$new('isolate');
      scope.options = $rootScope.options;
      scope.fromName = fromName;
      scope.toName = toName;
      scope.profileByName = $rootScope.profileByName;
      scope.dispNameFilter = dispNameFilter;
      scope.options = $scope.options;
      scope.profileSelect = function(model: any) {
        return `<div omega-profile-select="options | profiles:profile"
          ng-model="${model}" options="options"
          disp-name="dispNameFilter" style="display: inline-block;">
        </div>`;
      };
      $modal.open({
        templateUrl: 'partials/replace_profile.html',
        scope: scope,
      }).result.then(function({fromName, toName}: any) {
        omegaTarget.replaceRef(fromName, toName).then(function() {
          $rootScope.showAlert({
            type: 'success',
            i18n: 'options_replaceProfileSuccess',
          });
        }).catch(function(err: any) {
          $rootScope.showAlert({
            type: 'error',
            message: err,
          });
        });
      });
    });
  };


  $rootScope.renameProfile = function(fromName: any) {
    $rootScope.applyOptionsConfirm().then(function() {
      const profile = $rootScope.profileByName(fromName);
      const scope = $rootScope.$new('isolate');
      scope.options = $rootScope.options;
      scope.fromName = fromName;
      scope.isProfileNameReserved = isProfileNameReserved;
      scope.isProfileNameHidden = isProfileNameHidden;
      scope.profileByName = $rootScope.profileByName;
      scope.validateProfileName = {
        conflict: '!$value || $value == fromName || !profileByName($value)',
        reserved: '!$value || !isProfileNameReserved($value)',
      };
      scope.dispNameFilter = $scope.dispNameFilter;
      scope.options = $scope.options;
      $modal.open({
        templateUrl: 'partials/rename_profile.html',
        scope: scope,
      }).result.then(function(toName: any) {
        if (toName !== fromName) {
          let rename = omegaTarget.renameProfile(fromName, toName);
          const attachedName = getAttachedName(fromName);
          if ($rootScope.profileByName(attachedName)) {
            const toAttachedName = getAttachedName(toName);
            let defaultProfileName: any = undefined;
            if ($rootScope.profileByName(toAttachedName)) {
              defaultProfileName = profile.defaultProfileName;
              rename = rename.then(function() {
                const toAttachedKey = OmegaPac.Profiles.nameAsKey(toAttachedName);
                const profile = $rootScope.profileByName(toName);
                profile.defaultProfileName = 'direct';
                OmegaPac.Profiles.updateRevision(profile);
                delete $rootScope.options[toAttachedKey];
                $rootScope.applyOptions();
              });
            }
            rename = rename.then(function() {
              return omegaTarget.renameProfile(attachedName, toAttachedName);
            });
            if (defaultProfileName) {
              rename = rename.then(function() {
                const profile = $rootScope.profileByName(toName);
                profile.defaultProfileName = defaultProfileName;
                $rootScope.applyOptions();
              });
            }
          }
          rename.then(function() {
            $state.go('profile', {name: toName});
          }).catch(function(err: any) {
            $rootScope.showAlert({
              type: 'error',
              message: err,
            });
          });
        }
      });
    });
  };

  $scope.updatingProfile = {} as any;

  $rootScope.updateProfile = function(name: any) {
    $rootScope.applyOptionsConfirm().then(function() {
      if (name != null) {
        $scope.updatingProfile[name] = true;
      } else {
        OmegaPac.Profiles.each($scope.options, function(key: any, profile: any) {
          if (!profile.builtin) {
            $scope.updatingProfile[profile.name] = true;
          }
        });
      }

      omegaTarget.updateProfile(name, 'bypass_cache').then(function(results: any) {
        let success = 0;
        let error = 0;
        for (const profileName in results) {
          if (results.hasOwnProperty(profileName)) {
            const result = results[profileName];
            if (result instanceof Error) {
              error++;
            } else {
              success++;
            }
          }
        }
        if (error === 0) {
          $rootScope.showAlert({
            type: 'success',
            i18n: 'options_profileDownloadSuccess',
          });
        } else {
          if (error === 1) {
            const singleErr = results[OmegaPac.Profiles.nameAsKey(name)];
            if (singleErr) {
              return $q.reject(singleErr);
            }
          }
          return $q.reject(results);
        }
      }).catch(function(err: any) {
        const message = tr('options_profileDownloadError_' + err.name,
          [err.statusCode ?? err.original?.statusCode ?? '']);
        if (message) {
          $rootScope.showAlert({
            type: 'error',
            message: message,
          });
        } else {
          $rootScope.showAlert({
            type: 'error',
            i18n: 'options_profileDownloadError',
          });
        }
      }).finally(function() {
        if (name != null) {
          $scope.updatingProfile[name] = false;
        } else {
          $scope.updatingProfile = {};
        }
      });
    });
  };

  const onOptionChange = function(options: any, oldOptions: any) {
    if (options === oldOptions || oldOptions == null) return;
    $rootScope.optionsDirty = true;
  };
  $rootScope.$watch('options', onOptionChange, true);

  $rootScope.$on('$stateChangeStart', function(event: any, _: any, __: any, fromState: any) {
    if (!checkFormValid()) {
      event.preventDefault();
    }
  });

  $rootScope.$on('$stateChangeSuccess', function() {
    omegaTarget.lastUrl($location.url());
  });

  $window.onbeforeunload = function() {
    if ($rootScope.optionsDirty) {
      return tr('options_optionsNotSaved');
    } else {
      return null;
    }
  };

  document.addEventListener('click', (function() {
    $rootScope.hideAlert();
  }), false);

  $scope.profileIcons = profileIcons;
  $scope.dispNameFilter = dispNameFilter;

  for (const type in OmegaPac.Profiles.formatByType) {
    if (OmegaPac.Profiles.formatByType.hasOwnProperty(type)) {
      $scope.profileIcons[type] = $scope.profileIcons['RuleListProfile'];
    }
  }

  $scope.alertIcons = {
    'success': 'glyphicon-ok',
    'warning': 'glyphicon-warning-sign',
    'error': 'glyphicon-remove',
    'danger': 'glyphicon-danger',
  };

  $scope.alertClassForType = function(type: any) {
    if (!type) return '';
    if (type === 'error') {
      type = 'danger';
    }
    return 'alert-' + type;
  };

  $scope.downloadIntervals = [15, 60, 180, 360, 720, 1440, -1];
  $scope.downloadIntervalI18n = function(interval: any) {
    return "options_downloadInterval_" + (interval < 0 ? "never" : interval);
  };

  const themeItems: any[] = [];
  for (const key in themes) {
    const val = themes[key];
    val.key = 'others/base16-' + key;
    val.displayName = '(' +
      (val.dark ? '🌚' : '🌞') + ')    ' + key;
    themeItems.push(val);
  }
  $scope.themeItems = themeItems;
  $scope.selectedItem = {data: null};

  const changeTheme = function(themeKey: any) {
    if (!themeKey) {
      $scope.customCss = '';
      $scope.options['-customCss'] = $scope.customCss;
      return;
    }
    const getText = function(url: any) {
      //url = chrome.runtime.getURL(url)
      return fetch(url).then(function(res: any) { return res.text(); });
    };

    let variableCss = '';
    let baseCss = '';
    let themeCss = '';
    getText('lib/themes/variable.css').then(function(result: any) {
      variableCss = result;
      return getText('lib/themes/' + themeKey + '.css');
    }).then(function(result: any) {
      themeCss = result;
      return getText('lib/themes/base.css');
    }).then(function(result: any) {
      baseCss = result;
    }).then(function() {
      $scope.customCss = [variableCss, themeCss, baseCss].join('\n');
      $scope.options['-customCss'] = $scope.customCss;
      $scope.$applyAsync();
    }).catch(function() {
      $scope.customCss = '';
      $scope.options['-customCss'] = $scope.customCss;
      $scope.$applyAsync();
    });
  };

  $scope.selectTheme = function() {
    const themeItem = $scope.selectedItem || {data: {}};
    changeTheme(themeItem.data.key);
  };
  $scope.changeTheme = changeTheme;
  $scope.openShortcutConfig = omegaTarget.openShortcutConfig.bind(omegaTarget);

  let showFirstRunOnce = true;
  const showFirstRun = function() {
    if (!showFirstRunOnce) return;
    showFirstRunOnce = false;
    omegaTarget.state('firstRun').then(function(firstRun: any) {
      if (!firstRun) return;
      omegaTarget.state('firstRun', '');

      let profileName: any = null;
      OmegaPac.Profiles.each($rootScope.options, function(key: any, profile: any) {
        if (!profileName && profile.profileType === 'FixedProfile') {
          profileName = profile.name;
        }
      });
      if (!profileName) return;

      const scope = $rootScope.$new('isolate');
      scope.upgrade = (firstRun === 'upgrade');
      $modal.open({
        templateUrl: 'partials/options_welcome.html',
        keyboard: false,
        scope: scope,
        backdrop: 'static',
        backdropClass: 'opacity-half',
      }).result.then(function(r: any) {
        switch (r) {
          case 'later':
            return;
          case 'show':
            $state.go('profile', {name: profileName}).then(function() {
              $script('js/options_guide.js');
            });
        }
      });
    });
  };

  omegaTarget.refresh();

});
