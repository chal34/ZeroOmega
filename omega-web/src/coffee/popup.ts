const module = angular.module('omegaPopup', ['omegaTarget', 'omegaDecoration',
  'ui.bootstrap', 'ui.validate']);

module.filter('tr', function(omegaTarget: any) { return omegaTarget.getMessage; });
module.filter('dispName', function(omegaTarget: any) {
  return function(name: any) {
    if (typeof name === 'object') {
      name = name.name;
    }
    return omegaTarget.getMessage('profile_' + name) || name;
  };
});

function moveUp(activeIndex: number, items: any) {
  const i = activeIndex - 1;
  if (i >= 0) {
    items.eq(i)[0]?.focus();
  }
}
function moveDown(activeIndex: number, items: any) {
  items.eq(activeIndex + 1)[0]?.focus();
}

const shortcutKeys: any = {
  38: moveUp,       // Up
  40: moveDown,     // Down
  74: moveDown,     // j
  75: moveUp,       // k
  48: '+direct',    // 0
  83: '+system',    // s
  191: 'help',      // /
  63: 'help',       // ?
  69: 'external',   // e
  65: 'addRule',    // a
  43: 'addRule',    // +
  61: 'addRule',    // =
  84: 'tempRule',   // t
  79: 'option',     // o
  82: 'requestInfo', // r
};

for (let i = 1; i <= 9; i++) {
  shortcutKeys[48 + i] = i;
}

let subdomainLevel = 0;
let summaryDetail = false;

const customProfiles = (function() {
  let _customProfiles: any = null;
  return function() {
    _customProfiles = _customProfiles ?? jQuery('.custom-profile:not(.ng-hide) > a');
    return _customProfiles;
  };
})();

jQuery(document).on('keydown', function(e: any) {
  const handler = shortcutKeys[e.keyCode];
  if (!handler) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (typeof handler) {
    case 'string':
      switch (handler) {
        case 'help': {
          const showHelp = function(element: any, key: any) {
            if (typeof element === 'string') {
              element = jQuery(`a[data-shortcut='${element}']`);
            }
            let span = jQuery('.shortcut-help', element);
            if (span.length === 0) {
              span = jQuery('<span/>').addClass('shortcut-help');
            }
            span.text(key);
            element.find('.glyphicon').after(span);
          };
          const keys: any = {
            '+direct': '0',
            '+system': 'S',
            'external': 'E',
            'addRule': 'A',
            'tempRule': 'T',
            'option': 'O',
            'requestInfo': 'R',
          };
          for (const shortcut in keys) {
            showHelp(shortcut, keys[shortcut]);
          }
          customProfiles().each(function(i: number, el: any) {
            if (i <= 8) {
              showHelp(jQuery(el), i + 1);
            }
          });
          break;
        }
        default:
          jQuery(`a[data-shortcut='${handler}']`)[0]?.click();
          break;
      }
      break;
    case 'number':
      customProfiles().eq(handler - 1)?.click();
      break;
    case 'function': {
      const items = jQuery('.popup-menu-nav > li:not(.ng-hide) > a');
      let i = items.index(jQuery(e.target).closest('a'));
      if (i === -1) {
        i = items.index(jQuery('.popup-menu-nav > li.active > a'));
      }
      handler(i, items);
      break;
    }
  }

  return false;
});

module.controller('PopupCtrl', function($scope: any, $window: any, $q: any, omegaTarget: any,
  profileIcons: any, profileOrder: any, dispNameFilter: any, getVirtualTarget: any
) {
  omegaTarget.state('customCss').then(function(customCss: any) {
    if (customCss == null) customCss = '';
    $scope.customCss = customCss;
  });

  $scope.closePopup = function() {
    $window.top.close();
  };

  $scope.openManage = function() {
    omegaTarget.openManage();
    $window.top.close();
  };

  let refreshOnProfileChange = false;
  const refresh = function() {
    if (refreshOnProfileChange) {
      omegaTarget.refreshActivePage().then(function() {
        $window.top.close();
      });
    } else {
      $window.top.close();
    }
  };
  $scope.profileIcons = profileIcons;
  $scope.dispNameFilter = dispNameFilter;
  $scope.isActive = function(profileName: any) {
    if ($scope.isSystemProfile) {
      return profileName === 'system';
    } else {
      return $scope.currentProfileName === profileName;
    }
  };
  $scope.isEffective = function(profileName: any) {
    return $scope.isSystemProfile && $scope.currentProfileName === profileName;
  };
  $scope.getIcon = function(profile: any, normal: any) {
    if (!profile) return;
    if (!normal && $scope.isEffective(profile.name)) {
      return 'glyphicon-ok';
    } else {
      return undefined;
    }
  };
  $scope.getProfileTitle = function(profile: any, normal: any) {
    let desc = '';
    while (profile) {
      desc = profile.desc;
      profile = getVirtualTarget(profile, $scope.availableProfiles);
    }
    return desc || profile?.name || '';
  };
  $scope.openOptions = function(hash: any) {
    return omegaTarget.openOptions(hash).then(function() {
      $window.top.close();
    });
  };
  $scope.openConditionHelp = function() {
    const pname = encodeURIComponent($scope.currentProfileName);
    $scope.openOptions(`#!/profile/${pname}?help=condition`);
  };

  $scope.applyProfile = function(profile: any) {
    const next = function() {
      if (profile.profileType === 'SwitchProfile') {
        return omegaTarget.state('web.switchGuide').then(function(switchGuide: any) {
          if (switchGuide === 'showOnFirstUse') {
            return $scope.openOptions(`#!/profile/${profile.name}`);
          }
        });
      }
    };
    let apply: any;
    if (!refreshOnProfileChange) {
      omegaTarget.applyProfileNoReply(profile.name);
      apply = next();
    } else {
      apply = omegaTarget.applyProfile(profile.name).then(function() {
        return omegaTarget.refreshActivePage();
      }).then(next);
    }

    if (apply) {
      apply.then(function() { $window.top.close(); });
    } else {
      $window.top.close();
    }
  };

  $scope.tempRuleMenu = {open: false};
  $scope.nameExternal = {open: false};
  $scope.addTempRule = function(domain: any, profileName: any) {
    $scope.tempRuleMenu.open = false;
    omegaTarget.addTempRule(domain, profileName).then(function() {
      omegaTarget.state('lastProfileNameForCondition', profileName);
      refresh();
    });
  };

  $scope.setDefaultProfile = function(profileName: any, defaultProfileName: any) {
    omegaTarget.setDefaultProfile(profileName, defaultProfileName).then(function() {
      refresh();
    });
  };

  $scope.addCondition = function(condition: any, profileName: any) {
    omegaTarget.addCondition(condition, profileName).then(function() {
      omegaTarget.state('lastProfileNameForCondition', profileName);
      refresh();
    });
  };

  $scope.addConditionForDomains = function(domains: any, profileName: any) {
    const conditions: any[] = [];
    for (const domain in domains) {
      if (domains.hasOwnProperty(domain) && domains[domain]) {
        conditions.push({
          conditionType: 'HostWildcardCondition',
          pattern: domain,
        });
      }
    }
    omegaTarget.addCondition(conditions, profileName).then(function() {
      omegaTarget.state('lastProfileNameForCondition', profileName);
      refresh();
    });
  };

  $scope.addTempConditionForDomains = function(domains: any, profileName: any) {
    const conditions: any[] = [];
    const promises: any[] = [];
    for (const domain in domains) {
      if (domains.hasOwnProperty(domain) && domains[domain]) {
        promises.push(omegaTarget.addTempRule(
          domain.substring(2),
          profileName, 1)
        );
      }
    }
    Promise.all(promises).then(function() {
      omegaTarget.state('lastProfileNameForCondition', profileName);
      refresh();
    });
  };

  $scope.validateProfileName = {
    conflict: '!$value || !availableProfiles["+" + $value]',
    hidden: '!$value || $value[0] != "_"',
  };

  $scope.saveExternal = function() {
    $scope.nameExternal.open = false;
    const name = $scope.externalProfile?.name;
    if (name) {
      omegaTarget.addProfile($scope.externalProfile).then(function() {
        omegaTarget.applyProfile(name).then(function() {
          refresh();
        });
      });
    }
  };

  $scope.returnToMenu = function() {
    if (location.hash.indexOf('!') >= 0) {
      location.href = 'popup/index.html';
      return;
    }
    $scope.showConditionForm = false;
    $scope.showRequestInfo = false;
  };

  let preselectedProfileNameForCondition = 'direct';

  if ($window.location.hash === '#!requestInfo') {
    $scope.showRequestInfo = true;
  } else if ($window.location.hash === '#!external') {
    $scope.nameExternal = {open: true};
  }

  omegaTarget.state([
    'availableProfiles', 'currentProfileName', 'isSystemProfile',
    'validResultProfiles', 'refreshOnProfileChange', 'externalProfile',
    'proxyNotControllable', 'lastProfileNameForCondition',
  ]).then(function([availableProfiles, currentProfileName, isSystemProfile,
    validResultProfiles, refresh_flag, externalProfile,
    proxyNotControllable, lastProfileNameForCondition]: any[]) {
    $scope.proxyNotControllable = proxyNotControllable;
    if (proxyNotControllable) return;
    $scope.availableProfiles = availableProfiles;
    $scope.currentProfile = availableProfiles['+' + currentProfileName];
    $scope.currentProfileName = currentProfileName;
    $scope.isSystemProfile = isSystemProfile;
    $scope.externalProfile = externalProfile;
    refreshOnProfileChange = refresh_flag;

    const charCodeUnderscore = '_'.charCodeAt(0);
    const profilesByNames = function(names: any[]) {
      const profiles: any[] = [];
      for (const name of names) {
        const shown = (name.charCodeAt(0) !== charCodeUnderscore ||
                       name.charCodeAt(1) !== charCodeUnderscore);
        if (shown) {
          profiles.push(availableProfiles['+' + name]);
        }
      }
      return profiles;
    };

    $scope.validResultProfiles = profilesByNames(validResultProfiles);

    if (lastProfileNameForCondition) {
      for (const profile of $scope.validResultProfiles) {
        if (profile.name === lastProfileNameForCondition) {
          preselectedProfileNameForCondition = lastProfileNameForCondition;
        }
      }
    }

    $scope.builtinProfiles = [];
    $scope.customProfiles = [];
    for (const key in availableProfiles) {
      if (availableProfiles.hasOwnProperty(key)) {
        const profile = availableProfiles[key];
        if (profile.builtin) {
          $scope.builtinProfiles.push(profile);
        } else if (profile.name.charCodeAt(0) !== charCodeUnderscore) {
          $scope.customProfiles.push(profile);
        }
        if (profile.validResultProfiles) {
          profile.validResultProfiles =
            profilesByNames(profile.validResultProfiles);
        }
      }
    }

    $scope.customProfiles.sort(profileOrder);
  });

  $scope.domainsForCondition = {};
  $scope.requestInfoProvided = null;
  const generateDomainInfos = function(info: any) {
    const domains: any[] = [];
    let summary = info.summary;
    if (!summaryDetail) {
      summary = {};
      for (const domain in info.summary) {
        if (info.summary.hasOwnProperty(domain)) {
          const domainInfo = info.summary[domain];
          let summaryItem = summary[domainInfo.baseDomain];
          if (!summaryItem) {
            summaryItem = {
              errorCount: domainInfo.errorCount,
              domain: domainInfo.baseDomain,
              baseDomain: domainInfo.baseDomain,
            };
            summary[domainInfo.baseDomain] = summaryItem;
          } else {
            summaryItem.errorCount += domainInfo.errorCount;
          }
        }
      }
    }
    for (const domain in summary) {
      if (summary.hasOwnProperty(domain)) {
        const domainInfo = summary[domain];
        domainInfo.domain = domain;
        domains.push(domainInfo);
      }
    }
    domains.sort(function(a: any, b: any) { return b.errorCount - a.errorCount; });
    return domains;
  };

  $scope.toggleSummarDetail = function(event: any) {
    event.preventDefault();
    event.stopPropagation();
    $scope.domainsForCondition = {};
    $scope.requestInfoProvided = null;
    summaryDetail = !summaryDetail;
    const info = $scope.requestInfo;
    info.domains = generateDomainInfos(info);
    $scope.requestInfo = info;
    $scope.requestInfoProvided = $scope.requestInfoProvided ?? (info?.domains.length > 0);
    for (const domain of info.domains) {
      $scope.domainsForCondition[domain.domain] = $scope.domainsForCondition[domain.domain] ?? true;
    }
  };
  $scope.inspectNetworkTraffic = function(event: any) {
    event.preventDefault();
    event.stopPropagation();
    const sp = new URLSearchParams(document.location.search);
    const activeTabId = sp.get('activeTabId');
    const url = chrome.runtime.getURL('popup/network/index.html?tabId=') + activeTabId;
    chrome.tabs.create({url: url});
  };

  omegaTarget.setRequestInfoCallback(function(info: any) {
    info.domains = generateDomainInfos(info);
    $scope.$apply(function() {
      $scope.requestInfo = info;
      $scope.requestInfoProvided = $scope.requestInfoProvided ?? (info?.domains.length > 0);
      for (const domain of info.domains) {
        $scope.domainsForCondition[domain.domain] = $scope.domainsForCondition[domain.domain] ?? true;
      }
      $scope.profileForDomains = $scope.profileForDomains ?? preselectedProfileNameForCondition;
    });
  });

  $q.all([
    omegaTarget.state('currentProfileCanAddRule'),
    omegaTarget.getActivePageInfo(),
  ]).then(function([canAddRule, info]: any[]) {
    $scope.currentProfileCanAddRule = canAddRule;
    if (info) {
      $scope.currentTempRuleProfile = info.tempRuleProfileName;
      if ($scope.currentTempRuleProfile) {
        preselectedProfileNameForCondition = $scope.currentTempRuleProfile;
      }
      $scope.currentDomain = info.domain;
      $scope.subdomain = info.subdomain;
      if ($window.location.hash === '#!addRule') {
        $scope.prepareConditionForm();
      }
    }
  });
  const generateConditionSuggestion = function() {
    let currentDomain = $scope.currentDomain;
    const subdomain = $scope.subdomain;
    let currentDomainEscaped = currentDomain.replace(/\./g, '\\.');
    let domainLooksLikeIp = false;
    if (currentDomain.indexOf(':') >= 0) {
      domainLooksLikeIp = true;
      if (currentDomain[0] !== '[') {
        currentDomain = '[' + currentDomain + ']';
        currentDomainEscaped = currentDomain.replace(/\./g, '\\.')
          .replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      }
    } else if (currentDomain[currentDomain.length - 1] >= '0') {
      domainLooksLikeIp = true;
    }

    let conditionSuggestion: any;
    if (domainLooksLikeIp) {
      conditionSuggestion = {
        'HostWildcardCondition': currentDomain,
        'HostRegexCondition': '^' + currentDomainEscaped + '$',
        'UrlWildcardCondition': '*://' + currentDomain + '/*',
        'UrlRegexCondition': '://' + currentDomainEscaped + '(:\\d+)?/',
        'KeywordCondition': currentDomain,
      };
    } else {
      if (subdomain) {
        let subdomains = subdomain.split('.');
        subdomainLevel = subdomainLevel % (subdomains.length + 1);
        if (subdomainLevel > 0) {
          subdomains = subdomains.splice(subdomainLevel - 1);
          subdomains.push(currentDomain);
          currentDomain = subdomains.join('.');
          currentDomainEscaped = currentDomain.replace(/\./g, '\\.');
        }
      }
      conditionSuggestion = {
        'HostWildcardCondition': '*.' + currentDomain,
        'HostRegexCondition': '(^|\\\\.)' + currentDomainEscaped + '$',
        'UrlWildcardCondition': '*://*.' + currentDomain + '/*',
        'UrlRegexCondition':
          '://([^/.]+\\.)*' + currentDomainEscaped + '(:\\d+)?/',
        'KeywordCondition': currentDomain,
      };
    }
    return conditionSuggestion;
  };



  $scope.prepareConditionForm = function() {
    const conditionSuggestion = generateConditionSuggestion();
    $scope.rule = {
      condition: {
        conditionType: 'HostWildcardCondition',
        pattern: conditionSuggestion['HostWildcardCondition'],
      },
      profileName: preselectedProfileNameForCondition,
    };
    $scope.$watch('rule.condition.conditionType', function(type: any) {
      $scope.rule.condition.pattern = conditionSuggestion[type];
    });
    $scope.toggleSubDomainLevel = function(domain: any) {
      domain = domain || $scope.currentDomain;
      if ($window.location.hash === '#!addRule') {
        subdomainLevel++;
        const newSuggestion = generateConditionSuggestion();
        $scope.rule.condition.pattern =
          newSuggestion[$scope.rule.condition.conditionType];
      } else {
        console.log('change domain....');
      }
    };


    $scope.showConditionForm = true;
  };
});
