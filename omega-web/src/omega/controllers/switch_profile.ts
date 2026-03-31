angular.module('omega').controller('SwitchProfileCtrl', function($scope: any, $rootScope: any,
  $location: any, $timeout: any, $q: any, $modal: any, profileIcons: any, getAttachedName: any, omegaTarget: any,
  trFilter: any, downloadFile: any) {
  // == Rule list ==
  $scope.ruleListFormats = OmegaPac.Profiles.ruleListFormats;

  const exportRuleList = function() {
    let text = OmegaPac.RuleList.Switchy.compose({
      rules: $scope.profile.rules,
      defaultProfileName: $scope.attachedOptions.defaultProfileName,
    });

    const eol = '\r\n';
    let info = '\n';
    info += '; Require: ZeroOmega >= 2.3.2' + eol;
    info += `; Date: ${new Date().toLocaleDateString()}` + eol;
    info += `; Usage: ${trFilter('ruleList_usageUrl')}` + eol;

    text = text.replace('\n', info);

    const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    const fileName = $scope.profile.name.replace(/\W+/g, '_');
    downloadFile(blob, `OmegaRules_${fileName}.sorl`);
  };

  const exportLegacyRuleList = function() {
    let wildcardRules = '';
    let regexpRules = '';
    for (const rule of $scope.profile.rules) {
      let i = '';
      if (rule.profileName === $scope.attachedOptions.defaultProfileName) {
        i = '!';
      }
      switch (rule.condition.conditionType) {
        case 'HostWildcardCondition':
          wildcardRules += i + '@*://' + rule.condition.pattern + '/*' + '\r\n';
          break;
        case 'UrlWildcardCondition':
          wildcardRules += i + '@' + rule.condition.pattern + '\r\n';
          break;
        case 'UrlRegexCondition':
          regexpRules += i + rule.condition.pattern + '\r\n';
          break;
      }
    }

    const text = `; Summary: Proxy Switchy! Exported Rule List
; Date: ${new Date().toLocaleDateString()}
; Website: ${trFilter('ruleList_usageUrl')}

#BEGIN

[wildcard]
${wildcardRules}
[regexp]
${regexpRules}
#END
`;
    const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    const fileName = $scope.profile.name.replace(/\W+/g, '_');
    downloadFile(blob, `SwitchyRules_${fileName}.ssrl`);
  };

  // == Condition types ==
  $scope.conditionHelp = {
    show: ($location.search().help === 'condition'),
  };

  $scope.basicConditionTypes = [
    {
      group: 'default',
      types: [
        'HostWildcardCondition',
        'UrlWildcardCondition',
        'UrlRegexCondition',
        'FalseCondition',
      ],
    },
  ];

  $scope.advancedConditionTypes = [
    {
      group: 'host',
      types: [
        'HostWildcardCondition',
        'HostRegexCondition',
        'HostLevelsCondition',
        'IpCondition',
      ],
    },
    {
      group: 'url',
      types: [
        'UrlWildcardCondition',
        'UrlRegexCondition',
        'KeywordCondition',
      ],
    },
    {
      group: 'special',
      types: [
        'WeekdayCondition',
        'TimeCondition',
        'FalseCondition',
      ],
    },
  ];

  const expandGroups = function(groups: any[]) {
    const result: any[] = [];
    for (const group of groups) {
      for (const type of group.types) {
        result.push({type: type, group: 'condition_group_' + group.group});
      }
    }
    return result;
  };

  const basicConditionTypesExpanded = expandGroups($scope.basicConditionTypes);
  const advancedConditionTypesExpanded = expandGroups($scope.advancedConditionTypes);

  const basicConditionTypeSet: any = {};
  for (const type of basicConditionTypesExpanded) {
    basicConditionTypeSet[type.type] = type.type;
  }

  $scope.conditionTypes = basicConditionTypesExpanded;

  $scope.showConditionTypes = 0;
  $scope.hasConditionTypes = 0;
  $scope.hasUrlConditions = false;
  $scope.isUrlConditionType = {
    'UrlWildcardCondition': true,
    'UrlRegexCondition': true,
  };

  const updateHasConditionTypes = function() {
    if (!$scope.profile?.rules) return;

    $scope.hasUrlConditions = false;
    for (const rule of $scope.profile.rules) {
      if ($scope.isUrlConditionType[rule.condition.conditionType]) {
        $scope.hasUrlConditions = true;
        break;
      }
    }

    if ($scope.hasConditionTypes !== 0) return;
    for (const rule of $scope.profile.rules) {
      // Convert TrueCondition to a HostWildcardCondition with pattern '*'.
      if (rule.condition.conditionType === 'TrueCondition') {
        rule.condition = {
          conditionType: 'HostWildcardCondition',
          pattern: '*',
        };
      }
      if (!basicConditionTypeSet[rule.condition.conditionType]) {
        $scope.hasConditionTypes = 1;
        $scope.showConditionTypes = 1;
        break;
      }
    }
  };

  let unwatchRules: any;

  $scope.$watch('options["-showConditionTypes"]', function(show: any) {
    show = show || 0;
    if (show > 0) {
      $scope.showConditionTypes = show;
    } else {
      updateHasConditionTypes();
      $scope.showConditionTypes = $scope.hasConditionTypes;
    }

    if ($scope.options['-exportLegacyRuleList']) {
      if ($scope.showConditionTypes > 0) {
        $scope.setExportRuleListHandler(exportRuleList, {warning: true});
      } else {
        $scope.setExportRuleListHandler(exportLegacyRuleList);
      }
    } else {
      $scope.setExportRuleListHandler(exportRuleList);
    }

    if ($scope.showConditionTypes === 0) {
      $scope.conditionTypes = basicConditionTypesExpanded;
      if ($scope.options['-exportLegacyRuleList']) {
        $scope.setExportRuleListHandler(exportLegacyRuleList);
      }
    } else {
      $scope.conditionTypes = advancedConditionTypesExpanded;
      if ($scope.options["-showConditionTypes"] == null) {
        $scope.options["-showConditionTypes"] = $scope.showConditionTypes;
      }
      unwatchRules?.();
    }
  });

  if ($scope.hasConditionTypes === 0) {
    unwatchRules = $scope.$watch('profile.rules', updateHasConditionTypes, true);
  }

  // == Rules ==
  const rulesReadyDefer = $q.defer();
  const rulesReady = rulesReadyDefer.promise;
  const stopWatchingForRules = $scope.$watch('profile.rules', function(rules: any) {
    if (!rules) return;
    stopWatchingForRules();
    rulesReadyDefer.resolve(rules);
  });

  $scope.addRule = function() {
    let rule: any;
    if ($scope.profile.rules.length > 0) {
      const templ = $scope.profile.rules[$scope.profile.rules.length - 1];
      rule = angular.copy(templ);
    } else {
      rule = {
        condition: {conditionType: 'HostWildcardCondition', pattern: ''},
        profileName: $scope.attachedOptions.defaultProfileName,
      };
    }
    if (rule.condition.pattern) {
      rule.condition.pattern = '';
    }
    $scope.profile.rules.push(rule);
  };

  $scope.validateCondition = function(condition: any, pattern: any) {
    if (condition.conditionType.indexOf('Regex') >= 0) {
      try {
        new RegExp(pattern);
      } catch (_) {
        return false;
      }
    }
    return true;
  };

  $scope.conditionHasWarning = function(condition: any) {
    if (condition.conditionType === 'HostWildcardCondition') {
      const pattern = condition.pattern;
      return pattern.indexOf(':') >= 0 || pattern.indexOf('/') >= 0;
    }
    return false;
  };

  $scope.validateIpCondition = function(condition: any, input: any) {
    if (!input) return false;
    const ip = OmegaPac.Conditions.parseIp(input);
    return ip != null;
  };

  $scope.getWeekdayList = OmegaPac.Conditions.getWeekdayList;
  $scope.updateDay = function(condition: any, i: any, selected: any) {
    condition.days = condition.days || '-------';
    const char = selected ? 'SMTWtFs'[i] : '-';
    condition.days = condition.days.substr(0, i) + char +
      condition.days.substr(i + 1);
    delete condition.startDay;
    delete condition.endDay;
  };

  $scope.removeRule = function(index: any) {
    const removeForReal = function() {
      $scope.profile.rules.splice(index, 1);
    };
    if ($scope.options['-confirmDeletion']) {
      const scope = $scope.$new('isolate');
      scope.rule = $scope.profile.rules[index];
      scope.ruleProfile = $scope.profileByName(scope.rule.profileName);
      scope.dispNameFilter = $scope.dispNameFilter;
      scope.options = $scope.options;
      $modal.open({
        templateUrl: 'partials/rule_remove_confirm.html',
        scope: scope,
      }).result.then(removeForReal);
    } else {
      removeForReal();
    }
  };

  $scope.cloneRule = function(index: any) {
    const rule = angular.copy($scope.profile.rules[index]);
    $scope.profile.rules.splice(index + 1, 0, rule);
    $timeout(function() {
      const input = angular.element(`.switch-rule-row:nth-child(${index + 2}) input`);
      input[0]?.focus();
      input[0]?.select();
    });
  };

  $scope.showNotes = false;
  $scope.addNote = function(index: any) {
    $scope.showNotes = true;
    unwatchRulesShowNote();
  };
  let unwatchRulesShowNote = $scope.$watch('profile.rules', (function(rules: any) {
    if (rules && rules.some(function(rule: any) { return !!rule.note; })) {
      $scope.showNotes = true;
      unwatchRulesShowNote();
    }
  }), true);

  $scope.resetRules = function() {
    const scope = $scope.$new('isolate');
    scope.ruleProfile =
      $scope.profileByName($scope.attachedOptions.defaultProfileName);
    scope.dispNameFilter = $scope.dispNameFilter;
    scope.options = $scope.options;
    $modal.open({
      templateUrl: 'partials/rule_reset_confirm.html',
      scope: scope,
    }).result.then(function() {
      for (const rule of $scope.profile.rules) {
        rule.profileName = $scope.attachedOptions.defaultProfileName;
      }
    });
  };

  $scope.sortableOptions = {
    handle: '.sort-bar',
    tolerance: 'pointer',
    axis: 'y',
    forceHelperSize: true,
    forcePlaceholderSize: true,
    containment: 'parent',
  };

  // == Attached ==
  const attachedReadyDefer = $q.defer();
  const attachedReady = attachedReadyDefer.promise;
  $scope.$watch('profile.name', function(name: any) {
    $scope.attachedName = getAttachedName(name);
    $scope.attachedKey = OmegaPac.Profiles.nameAsKey($scope.attachedName);
  });

  $scope.$watch('options[attachedKey]', function(attached: any) {
    $scope.attached = attached;
  });

  $scope.watchAndUpdateRevision('options[attachedKey]');

  let oldSourceUrl: any = null;
  let oldLastUpdate: any = null;
  let oldRuleList: any = null;
  const onAttachedChange = function(attached: any, oldAttached: any) {
    if (!attached || !oldAttached) return;
    if (attached.sourceUrl !== oldAttached.sourceUrl) {
      if (attached.lastUpdate) {
        oldSourceUrl = oldAttached.sourceUrl;
        oldLastUpdate = attached.lastUpdate;
        oldRuleList = oldAttached.ruleList;
        attached.lastUpdate = null;
      } else if (oldSourceUrl && attached.sourceUrl === oldSourceUrl) {
        attached.lastUpdate = oldLastUpdate;
        attached.ruleList = oldRuleList;
      }
    }
  };
  $scope.$watch('options[attachedKey]', onAttachedChange, true);

  $scope.attachedOptions = {enabled: false};
  $scope.$watch('profile.defaultProfileName', function(name: any) {
    $scope.attachedOptions.enabled = (name === $scope.attachedName);
    if (!$scope.attached || !$scope.attachedOptions.enabled) {
      $scope.attachedOptions.defaultProfileName = name;
    }
  });

  $scope.$watch('attachedOptions.enabled', function(enabled: any, oldValue: any) {
    if (enabled === oldValue) return;
    if (enabled) {
      if ($scope.profile.defaultProfileName !== $scope.attachedName) {
        $scope.profile.defaultProfileName = $scope.attachedName;
      }
    } else {
      if ($scope.profile.defaultProfileName === $scope.attachedName) {
        if ($scope.attached) {
          $scope.profile.defaultProfileName = $scope.attached.defaultProfileName;
          $scope.attachedOptions.defaultProfileName =
            $scope.attached.defaultProfileName;
        } else {
          $scope.profile.defaultProfileName = 'direct';
          $scope.attachedOptions.defaultProfileName = 'direct';
        }
      }
    }
  });

  $scope.$watch('attached.defaultProfileName', function(name: any) {
    if (name && $scope.attachedOptions.enabled) {
      $scope.attachedOptions.defaultProfileName = name;
    }
  });

  $scope.$watch('attachedOptions.defaultProfileName', function(name: any) {
    attachedReadyDefer.resolve();
    if ($scope.attached && $scope.attachedOptions.enabled) {
      $scope.attached.defaultProfileName = name;
    } else {
      $scope.profile.defaultProfileName = name;
    }
  });

  $scope.attachNew = function() {
    $scope.attached = OmegaPac.Profiles.create({
      name: $scope.attachedName,
      defaultProfileName: $scope.profile.defaultProfileName,
      profileType: 'RuleListProfile',
      color: $scope.profile.color,
    });
    OmegaPac.Profiles.updateRevision($scope.attached);
    $scope.options[$scope.attachedKey] = $scope.attached;
    $scope.attachedOptions.enabled = true;
    $scope.profile.defaultProfileName = $scope.attachedName;
  };

  $scope.removeAttached = function() {
    if (!$scope.attached) return;
    const scope = $scope.$new('isolate');
    scope.attached = $scope.attached;
    scope.dispNameFilter = $scope.dispNameFilter;
    scope.options = $scope.options;
    $modal.open({
      templateUrl: 'partials/delete_attached.html',
      scope: scope,
    }).result.then(function() {
      $scope.profile.defaultProfileName = $scope.attached.defaultProfileName;
      delete $scope.options[$scope.attachedKey];
    });
  };

  // == Edit source ==
  const stateEditorKey = 'web._profileEditor.' + $scope.profile.name;
  $scope.loadRules = false;
  $scope.editSource = false;
  const parseOmegaRules = function(code: any, {detect, requireResult}: any = {}): any {
    const setError = function(error: any) {
      if (error.reason) {
        const args = error.args ?? [
          error.sourceLineNo,
          error.source,
        ];
        const message = trFilter('ruleList_error_' + error.reason, args);
        if (message) error.message = message;
      }
      return {error: error};
    };
    if (detect && !OmegaPac.RuleList.Switchy.detect(code)) {
      return {error: {reason: 'notSwitchy'}};
    }
    const refs = OmegaPac.RuleList.Switchy.directReferenceSet({
      ruleList: code,
    });
    if (requireResult && !refs) {
      return setError({reason: 'resultNotEnabled'});
    }
    for (const key in refs) {
      if (refs.hasOwnProperty(key)) {
        const name = refs[key];
        if (!OmegaPac.Profiles.byKey(key, $scope.options)) {
          return setError({reason: 'unknownProfile', args: [name]});
        }
      }
    }
    try {
      return {rules: OmegaPac.RuleList.Switchy.parseOmega(code, null, null,
        {strict: true, source: false})};
    } catch (err) {
      return setError(err);
    }
  };
  const parseSource = function() {
    if (!$scope.source) return true;
    const {rules, error} = parseOmegaRules($scope.source.code.trim(),
      {requireResult: true});
    if (error) {
      $scope.source.error = error;
      $scope.editSource = true;
      return false;
    } else {
      $scope.source.error = undefined;
    }
    $scope.attachedOptions.defaultProfileName = rules.pop().profileName;
    // Try to merge with existing rules if possible.
    const diffInst = jsondiffpatch.create({
      objectHash: function(obj: any) { return JSON.stringify(obj); },
      textDiff: {minLength: 1 / 0},
    });
    const oldRulesJson = angular.fromJson(angular.toJson($scope.profile.rules));
    const patch = diffInst.diff(oldRulesJson, rules);
    jsondiffpatch.patch($scope.profile.rules, patch);
    return true;
  };
  $scope.toggleSource = function() { return $q.all([attachedReady, rulesReady]).then(function() {
    $scope.editSource = !$scope.editSource;
    if ($scope.editSource) {
      const args = {
        rules: $scope.profile.rules,
        defaultProfileName: $scope.attachedOptions.defaultProfileName,
      };
      const code = OmegaPac.RuleList.Switchy.compose(args, {withResult: true});
      $scope.source = {code: code};
    } else {
      if (!parseSource()) return;
      $scope.source = null;
      $scope.loadRules = true;
    }
    omegaTarget.state(stateEditorKey, {editSource: $scope.editSource});
  }); };

  $rootScope.$on('$stateChangeStart', function(event: any, _: any, __: any, fromState: any) {
    if ($scope.editSource && $scope.source.touched) {
      const sourceValid = parseSource();
      if (!sourceValid) event.preventDefault();
    }
  });

  $scope.$on('omegaApplyOptions', function(event: any) {
    if ($scope.attached?.ruleList && !$scope.attached.sourceUrl) {
      $scope.attachedRuleListError = undefined;
      const {error} = parseOmegaRules($scope.attached.ruleList.trim(), {detect: true});
      if (error) {
        if (error.reason !== 'resultNotEnabled' && error.reason !== 'notSwitchy') {
          $scope.attachedRuleListError = error;
          event.preventDefault();
          angular.element('#attached-rulelist')[0].focus();
        }
      } else {
        $scope.attached.format = 'Switchy';
      }
    }

    if ($scope.editSource && $scope.source.touched) {
      event.preventDefault();
      if (parseSource()) {
        $scope.source.touched = false;
        $timeout(function() {
          $rootScope.applyOptions();
        });
      }
    }
  });

  omegaTarget.state(stateEditorKey).then(function(opts: any) {
    if (opts?.editSource) {
      $scope.toggleSource();
    } else {
      $scope.loadRules = true;
      const getState = omegaTarget.state(['web.switchGuide', 'firstRun']);
      $q.all([rulesReady, getState]).then(function([_, [switchGuide, firstRun]]: any[]) {
        if (firstRun || switchGuide === 'shown') return;
        omegaTarget.state('web.switchGuide', 'shown');
        if ($scope.profile.rules.length === 0) return;
        $script('js/switch_profile_guide.js');
      });
    }
  });
});
