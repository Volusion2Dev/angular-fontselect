/* global DEFAULT_WEBSAFE_FONTS, PROVIDER_WEBSAFE, PROVIDER_GOOGLE, REQUIRED_FONT_OBJECT_KEYS */
/* global GOOGLE_FONT_CATEGORIES, NAME_FONTSSERVICE, DEFAULT_CATEGORIES, URL_GOOGLE_FONTS_CSS */
/* global VARIANT_PRIORITY, SUBSET_PRIORITY, METHOD_GET, SUPPORT_KHMER, URL_GOOGLE_FONTS_API  */
/* global STATE_DEFAULTS  */

var _fontsServiceDeps = ['$http', '$q', 'jdFontselectConfig', '$filter'];

var _googleFontsInitiated = false;

function FontsService() {
  var self = this;

  for (var i = 0, l = _fontsServiceDeps.length; i <l; i++) {
    self[_fontsServiceDeps[i]] = arguments[i];
  }

  self._init();

  return self;
}

FontsService.$inject = _fontsServiceDeps;

FontsService.prototype = {
  _init: function() {
    var self = this;

    self._fonts = self._fonts || [];
    self._map = {};
    self._subsets = angular.copy(STATE_DEFAULTS.subsets);
    self._providers = angular.copy(STATE_DEFAULTS.providers);
    self._imports = {};
    self._usedProviders = {};
    self._initPromises = [];
    self._fontInitiators = {};
    self._asyncFontSearches = {};

    self.registerProvider(PROVIDER_GOOGLE, angular.bind(self, self._loadGoogleFont));
    self.registerProvider(PROVIDER_WEBSAFE, function() {});

    self._addDefaultFonts();
  },

  getAllFonts: function() {
    return this._fonts;
  },

  ready: function(callback) {
    var promise = this.$q.all(this._initPromises);
    if (angular.isFunction(callback)) {
      promise.then(callback);
    }
    return promise;
  },

  add: function(fontObj, provider) {
    var self = this;

    if (!angular.isString(provider)) {
      provider = angular.isString(fontObj.provider) ? fontObj.provider : PROVIDER_WEBSAFE;
    }

    fontObj.provider = provider;

    /* Set provider as "fall-back" in the font-stack, so we can use the stack as unique key */
    fontObj.stack += ', "' + provider + '"';

    if (!self.isValidFontObject(fontObj)) {
      throw 'Invalid font object.';
    }

    if (!angular.isObject(self._map[provider])) {
      self._map[provider] = {};
    }

    if (angular.isArray(fontObj.subsets)) {
      self.setSubsets(fontObj.subsets);
    }

    if (angular.isObject(self._asyncFontSearches[fontObj.stack])) {
      self._asyncFontSearches[fontObj.stack].forEach(function(callback) {
        callback(fontObj);
      });
      delete self._asyncFontSearches[fontObj.stack];
    }

    self._fonts.push(fontObj);
  },

  searchFonts: function(object) {
    var self = this;

    return self.$filter('filter')(self._fonts, object);
  },

  searchFont: function(object) {
    var self = this;

    var fonts = self.searchFonts(object);

    if (fonts.length > 0) {
      fonts = fonts[0];
    } else {
      return false;
    }

    return fonts;
  },

  getFontByKey: function(key, provider) {
    var self = this;

    if (!provider) {
      throw 'Provider is not set.';
    }

    var font = self.searchFont({key: key, provider: provider});

    if (!font) {
      throw 'Font "' + key + '" not found in "' + provider + '".';
    }

    return font;
  },

  getFontByStack: function(stack) {
    var self = this;

    var font = self.searchFont({stack: stack});

    if (!font) {
      throw new Error ('Font with stack "' + stack + '" not found.');
    }

    return font;
  },

  getFontByStackAsync: function(stack) {
    var self = this;
    var d = self.$q.defer();

    try {
      var font = self.getFontByStack(stack);
      d.resolve(font);
    } catch (e) {
      if (!angular.isArray(self._asyncFontSearches[stack])) {
        self._asyncFontSearches[stack] = [];
      }
      self._asyncFontSearches[stack].push(d.resolve);
    }

    self._initPromises.push(d.promise);
    return d.promise;
  },

  removeFont: function(font, provider) {
    var self = this;

    if (angular.isString(font) && !provider) {
      throw 'Provider is not set.';
    }

    try {
      if (angular.isString(font)) {
        font = self.getFontByKey(font, provider);
      }

      var index = self._fonts.indexOf(font);
      var retVal = 0;

      if (index >= 0) {
        retVal = self._fonts.splice(index, 1).length;
      }
      return retVal;
    } catch (e) {
      return 0;
    }
  },

  isValidFontObject: function(fontObj) {
    if (!angular.isObject(fontObj)) {
      return false;
    }

    var valid = true;

    angular.forEach(REQUIRED_FONT_OBJECT_KEYS, function(key) {
      if (angular.isUndefined(fontObj[key])) {
        valid = false;
      }
    });

    return valid;
  },

  getCategories: function() {
    return DEFAULT_CATEGORIES;
  },

  getImports: function() {
    return this._imports;
  },

  getSubsets: function() {
    return this._subsets;
  },

  getProviders: function() {
    return this._providers;
  },

  getUsage: function() {
    return this._usedProviders;
  },

  setSubsets: function(subsets, options) {
    var self = this;
    return self._setSelects(
      self._subsets,
      subsets,
      self._setSelectOptions(options)
    );
  },

  setProviders: function(providers, options) {
    var self = this;
    return self._setSelects(
      self._providers,
      providers,
      self._setSelectOptions(options)
    );
  },

  setImports: function(imports, options) {
    var self = this;
    return self._setSelects(
      self._imports,
      imports,
      self._setSelectOptions(options, {update: true})
    );
  },

  setUsage: function(usage, options) {
    var self = this;
    return self._setSelects(
      self._usedProviders,
      usage,
      self._setSelectOptions(options, {update: true})
    );
  },

  registerProvider: function(name, fontInitiator) {
    var self = this;

    var provider = {};
    provider[name] = false;
    self.setProviders(provider);
    self._usedProviders[name] = false;
    self._fontInitiators[name] = fontInitiator;
  },

  _setSelectOptions: function(options, additional) {
    if (typeof options === 'boolean') {
      options = {additive: options};
    }

    if (!angular.isObject(additional)) {
      additional = {};
    }

    options = angular.extend({
      additive: true,
      update: false
    }, options, additional);

    return options;
  },

  _setSelects: function(target, srcs, options) {
    if (angular.isUndefined(srcs)) {
      return target;
    }

    if (!angular.isObject(options)) {
      options = this._setSelectOptions(options);
    }

    if (angular.isArray(srcs)) {
      var srcsObj = {};
      for (var i = 0, l = srcs.length; i < l; i++) {
        srcsObj[srcs[i]] = false;
      }
      srcs = srcsObj;
    }

    /* If we aren't additive, remove all keys that are not present in srcs */
    if (!options.additive) {
      angular.forEach(target, function(active, src) {
        if (!srcs[src]) {
          delete target[src];
        }
      });
    }

    angular.forEach(srcs, function(active, src) {
      if (options.update || angular.isUndefined(target[src])) {
        target[src] = active;
      }
    });

    return target;
  },

  updateImports: function() {
    this.setImports(this.getUrls());
  },

  load: function(font) {
    if (font.loaded) {
      return;
    }

    font.loaded = true;
    this._fontInitiators[font.provider](font);
  },

  getUrls: function() {
    var self = this;
    var googleUrl = self.getGoogleUrl();
    var urls = {};

    if (googleUrl) {
      urls[PROVIDER_GOOGLE] = googleUrl;
    }

    return urls;
  },

  updateUsage: function(font, wasActivated) {
    var self = this;

    if (!angular.isNumber(font.used) || font.used < 0) {
      font.used = 0;
    }
    font.used += wasActivated === false ? -1 : 1;

    self._updateProvicerUsage();
  },


  _updateProvicerUsage: function() {
    var self = this;
    var filter = self.$filter('filter');
    var usedFonts = self.getUsedFonts();

    angular.forEach(self._providers, function(active, provider) {
      self._usedProviders[provider] = !!filter(
        usedFonts,
        {provider: provider}
      ).length;
    });
  },

  getUsedFonts: function() {
    var self = this;

    return self.$filter('filter')(self._fonts, {used: true}, function(used) {
      return !!used;
    });
  },

  getGoogleUrl: function() {
    var self = this;
    var googleFonts = self.$filter('filter')(self.getUsedFonts(), {provider: PROVIDER_GOOGLE});
    var subsets = [];
    var url = URL_GOOGLE_FONTS_CSS;

    if (googleFonts.length) {
      var googleNames = [];

      for (var i = 0, l = googleFonts.length; i < l; i++) {
        googleNames.push(googleFonts[i].name);
      }

      url += '?family=' + window.escape(googleNames.join('|'));

      angular.forEach(self._subsets, function(active, key) {
        if (active) {
          subsets.push(key);
        }
      });

      if (subsets.length) {
        url += '&subset=' + subsets.join(',');
      }

      return url;
    } else {
      return false;
    }
  },

  _remap: function(provider, from) {
    var self = this;
    var fonts = self._fonts[provider];

    if (!angular.isNumber(from)) {
      from = 0;
    }

    for (var i = from, l = fonts.length; i < l; i++) {
      self._map[provider][fonts[i].key] = i;
    }
  },

  _getBestOf: function(things, prios) {
    for (var i = 0, l = prios.length; i < l; i++) {
      var thing = prios[i];
      if (things.indexOf(thing) >= 0) {
        return thing;
      }
    }
    return things[0];
  },

  _getBestVariantOf: function(variants) {
    return this._getBestOf(variants, VARIANT_PRIORITY);
  },

  _getBestSubsetOf: function(subsets) {
    return this._getBestOf(subsets, SUBSET_PRIORITY);
  },

  _initGoogleFonts: function() {
    var self = this;

    if (!self.jdFontselectConfig.googleApiKey || _googleFontsInitiated) {
      return;
    }

    _googleFontsInitiated = true;

    var deferred = self.$q.defer();
    self._initPromises.push(deferred.promise);

    self.$http({
      method: METHOD_GET,
      url: URL_GOOGLE_FONTS_API,
      params: {
        sort: 'popularity',
        key: self.jdFontselectConfig.googleApiKey
      }
    }).success(function(response) {
      var amount = response.items.length;
      var ready = amount - 1;

      angular.forEach(response.items, function(font, i) {
        var category = self._getGoogleFontCat(font.family);
        if (SUPPORT_KHMER || font.subsets.length === 1 && font.subsets[0] === 'khmer') {
          return;
        }

        self.add({
          subsets: font.subsets,
          variants: font.variants,
          name: font.family,
          popularity: amount - i,
          key: _createKey(font.family),
          lastModified: font.lastModified,
          stack: '"' + font.family + '", ' + category.fallback,
          category: category.key
        }, PROVIDER_GOOGLE);

        if (ready === i) {
          deferred.resolve();
        }
      });
    }).error(deferred.reject);
  },

  _getGoogleFontCat: function(font) {
    var self = this;

    var categories = self.getCategories();
    for (var i = 0, l = categories.length; i < l; i++) {
      var category = categories[i];

      if (typeof GOOGLE_FONT_CATEGORIES[category.key] === 'undefined') {
        continue;
      }

      if (GOOGLE_FONT_CATEGORIES[category.key].indexOf(font) >= 0) {
        return category;
      }
    }

    // console.error('Category not Found:', font);
    return categories[5];
  },

  _addDefaultFonts: function() {
    var self = this;

    angular.forEach(DEFAULT_WEBSAFE_FONTS, function(font) {
      self.add(font);
    });
  },

  _loadGoogleFont: function(font) {
    var self = this;

    try {
      WebFont.load({
        google: {
          families: [font.name + ':' + self._getBestVariantOf(font.variants)],
          text: font.name,
          subsets: font.subsets,
          subset: self._getBestSubsetOf(font.subsets)
        }
      });
    } catch (e) {
      self.removeFont(font, PROVIDER_GOOGLE);
    }
  }
};

fontselectModule.factory(NAME_FONTSSERVICE, ['$injector', function($injector) {
  return $injector.instantiate(FontsService);
}]);
