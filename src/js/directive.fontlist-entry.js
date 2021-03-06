/* global FONTLIST_ENTRY_TYPE_HEADLINE, FONTLIST_ENTRY_TYPE_FONT, FONTLIST_ENTRY_TYPE_TEXT */
var NAME_JDFONTLIST_ENTRY = 'jdFontlistEntry';

fontselectModule.directive(NAME_JDFONTLIST_ENTRY, function() {
  return {
    scope: {
      entry: '=',
      current: '='
    },
    restrict: 'E',
    templateUrl: 'fontlist-entry.html',
    replace: true,
    link: function($scope) {
      $scope.isHeadline = $scope.entry.type === FONTLIST_ENTRY_TYPE_HEADLINE;
      $scope.isFont = $scope.entry.type === FONTLIST_ENTRY_TYPE_FONT;
      $scope.isText = $scope.entry.type === FONTLIST_ENTRY_TYPE_TEXT;
    }
  };
});
