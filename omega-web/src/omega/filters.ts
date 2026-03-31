angular.module('omega').filter('profiles', function(builtinProfiles: any, profileOrder: any,
  isProfileNameHidden: any, isProfileNameReserved: any) {

  const charCodePlus = '+'.charCodeAt(0);
  const builtinProfileList: any[] = [];
  for (const _ in builtinProfiles) {
    builtinProfileList.push(builtinProfiles[_]);
  }
  return function(options: any, filter: any) {
    let result: any[] = [];
    for (const name in options) {
      if (name.charCodeAt(0) === charCodePlus) {
        result.push(options[name]);
      }
    }
    if (typeof filter === 'object' || (
      typeof filter === 'string' && filter.charCodeAt(0) === charCodePlus)) {
      if (typeof filter === 'string') {
        filter = filter.substr(1);
      }
      result = OmegaPac.Profiles.validResultProfilesFor(filter, options);
    }
    if (filter === 'all') {
      result = result.filter(function(profile: any) { return !isProfileNameHidden(profile.name); });
      result = result.concat(builtinProfileList);
    } else {
      result = result.filter(function(profile: any) { return !isProfileNameReserved(profile.name); });
    }
    if (filter === 'sorted') {
      result.sort(profileOrder);
    }
    return result;
  };
});

angular.module('omega').filter('tr', function(omegaTarget: any) { return omegaTarget.getMessage; });
angular.module('omega').filter('dispName', function(omegaTarget: any) {
  return function(name: any) {
    if (typeof name === 'object') {
      name = name.name;
    }
    return omegaTarget.getMessage('profile_' + name) || name;
  };
});
