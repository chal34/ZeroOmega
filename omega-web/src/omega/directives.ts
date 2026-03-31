angular.module('omega').directive('inputGroupClear', function($timeout: any) {
  return {
    restrict: 'A',
    templateUrl: 'partials/input_group_clear.html',
    scope: {
      'model': '=model',
      'type': '@type',
      'ngPattern': '=?ngPattern',
      'placeholder': '@placeholder',
      'controller': '=?controller',
    },
    link: function(scope: any, element: any, attrs: any) {
      scope.catchAll = new RegExp('');
      $timeout(function() {
        scope.controller = element.find('input').controller('ngModel');
      });

      scope.oldModel = '';
      scope.controller = scope.input;
      scope.modelChange = function() {
        if (scope.model) {
          scope.oldModel = '';
        }
      };
      scope.toggleClear = function() {
        [scope.model, scope.oldModel] = [scope.oldModel, scope.model];
      };
    },
  };
});
angular.module('omega').directive('omegaUpload', function() {
  return {
    restrict: 'A',
    scope: {
      success: '&omegaUpload',
      error: '&omegaError',
    },
    link: function(scope: any, element: any, attrs: any) {
      const input = element[0];
      element.on('change', function() {
        if (input.files.length > 0 && input.files[0].name.length > 0) {
          const reader = new FileReader();
          reader.addEventListener('load', function(e: any) {
            scope.$apply(function() {
              scope.success({'$content': e.target.result});
            });
          });
          reader.addEventListener('error', function(e: any) {
            scope.$apply(function() {
              scope.error({'$error': e.target.error});
            });
          });
          reader.readAsText(input.files[0]);
          input.value = '';
        }
      });
    },
  };
});
angular.module('omega').directive('omegaIp2str', function() {
  return {
    restrict: 'A',
    priority: 2, // Run post-link after input directive (0) and ngModel (1).
    require: 'ngModel',
    link: function(scope: any, element: any, attr: any, ngModel: any) {
      ngModel.$parsers.push(function(value: any) {
        if (value) {
          return OmegaPac.Conditions.fromStr('Ip: ' + value);
        } else {
          return ({conditionType: 'IpCondition', ip: '0.0.0.0', prefixLength: 0});
        }
      });
      ngModel.$formatters.push(function(value: any) {
        if (value?.ip) {
          return OmegaPac.Conditions.str(value).split(' ', 2)[1];
        } else {
          return '';
        }
      });
    },
  };
});
