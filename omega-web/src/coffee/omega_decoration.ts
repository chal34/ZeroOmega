const orderForType: any = {
  'FixedProfile': -2000,
  'PacProfile': -1000,
  'VirtualProfile': 1000,
  'SwitchProfile': 2000,
  'RuleListProfile': 3000,
};

angular.module('omegaDecoration', []).value('profileIcons', {
  'DirectProfile': 'glyphicon-transfer',
  'SystemProfile': 'glyphicon-off',
  'AutoDetectProfile': 'glyphicon-file',
  'FixedProfile': 'glyphicon-globe',
  'PacProfile': 'glyphicon-file',
  'VirtualProfile': 'glyphicon-question-sign',
  'RuleListProfile': 'glyphicon-list',
  'SwitchProfile': 'glyphicon-retweet',
}).constant('profileOrder', function(a: any, b: any) {
  const diff = (orderForType[a.profileType] | 0) - (orderForType[b.profileType] | 0);
  if (diff !== 0) return diff;
  if (a.name === b.name) {
    return 0;
  } else if (a.name < b.name) {
    return -1;
  } else {
    return 1;
  }
}).constant('getVirtualTarget', function(profile: any, options: any) {
  if (profile?.profileType === 'VirtualProfile') {
    return options?.['+' + profile.defaultProfileName];
  }
}).directive('omegaProfileIcon', function(profileIcons: any, getVirtualTarget: any) {
  return {
    restrict: 'A',
    template: `
      <span ng-style="{color: color || getColor(profile)}"
        ng-class="{'virtual-profile-icon': isVirtual(profile)}"
        class="glyphicon {{icon || getIcon(profile)}}">
      </span>
    `,
    scope: {
      'profile': '=?omegaProfileIcon',
      'icon': '=?icon',
      'color': '=?color',
      'options': '=options',
    },
    link: function(scope: any, element: any, attrs: any, ngModel: any) {
      scope.profileIcons = profileIcons;
      scope.isVirtual = function(profile: any) {
        return profile?.profileType === 'VirtualProfile';
      };
      scope.getIcon = function(profile: any) {
        let type = profile?.profileType;
        type = getVirtualTarget(profile, scope.options)?.profileType ?? type;
        return profileIcons[type];
      };
      scope.getColor = function(profile: any) {
        let color: any = undefined;
        while (profile) {
          color = profile.color;
          profile = getVirtualTarget(profile, scope.options);
        }
        return color;
      };
    },
  };
}).directive('omegaProfileInline', function() {
  return {
    restrict: 'A',
    template: `
      <span omega-profile-icon="profile" options="options"></span>
      {{dispName ? dispName(profile) : profile.name}}
    `,
    scope: {
      'profile': '=omegaProfileInline',
      'dispName': '=?dispName',
      'options': '=options',
    },
  };
}).directive('omegaHtml', function($compile: any) {
  return {
    restrict: 'A',
    link: function(scope: any, element: any, attrs: any, ngModel: any) {
      const locals: any = {
        $profile: function(profile = 'profile', dispName = 'dispNameFilter',
          options = 'options') {
          return `<span class="profile-inline" omega-profile-inline="${profile}"
            disp-name="${dispName}" options="${options}"></span>`;
        },
      };
      const getHtml = () => scope.$eval(attrs.omegaHtml, locals);
      scope.$watch(getHtml, function(html: any) {
        element.html(html);
        $compile(element.contents())(scope);
      });
    },
  };
}).directive('omegaProfileSelect', function($timeout: any, profileIcons: any) {
  return {
    restrict: 'A',
    templateUrl: 'partials/omega_profile_select.html',
    require: '?ngModel',
    scope: {
      'profiles': '&omegaProfileSelect',
      'defaultText': '@?defaultText',
      'dispName': '=?dispName',
      'options': '=options',
    },
    link: function(scope: any, element: any, attrs: any, ngModel: any) {
      scope.profileIcons = profileIcons;
      scope.currentProfiles = [];
      scope.dispProfiles = undefined;
      const updateView = function() {
        scope.profileIcon = '';
        for (const profile of scope.currentProfiles) {
          if (profile.name === scope.profileName) {
            scope.selectedProfile = profile;
            scope.profileIcon = profileIcons[profile.profileType];
            break;
          }
        }
      };
      scope.$watch(scope.profiles, (function(profiles: any) {
        scope.currentProfiles = profiles || [];
        if (scope.dispProfiles != null) {
          scope.dispProfiles = scope.currentProfiles;
        }
        updateView();
      }), true);

      scope.toggled = function(open: any) {
        if (open && scope.dispProfiles == null) {
          scope.dispProfiles = scope.currentProfiles;
          scope.toggled = undefined;
        }
      };

      if (ngModel) {
        ngModel.$render = function() {
          scope.profileName = ngModel.$viewValue;
          updateView();
        };
      }

      scope.setProfileName = function(name: any) {
        if (ngModel) {
          ngModel.$setViewValue(name);
          ngModel.$render();
        }
      };

      scope.getName = function(profile: any) {
        if (profile) {
          return scope.dispName(profile) || profile.name;
        }
      };
    },
  };
});
