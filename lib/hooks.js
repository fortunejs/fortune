var RSVP = require('rsvp');
var _ = require('lodash');
var crypto = require('crypto');

var hooksAll = exports._hooksAll = {
  _before:{
    read: [],
    write: []
  },
  _after: {
    read: [],
    write: []
  }
};

/**
 * For internal use by fortune in beforeAll/afterAll
 * @param when
 * @param type
 * @param provider - Array of hooks. name and init props are required
 * @param config - Array of additional configuration for global hook
 */
exports.registerGlobalHook = function(when, type, provider, config){
  provider.forEach(function(hook){
    var inlineConfig = {};
    inlineConfig[hook.name] = matchConfig(hook, config);
    hook.priority = hook.priority || 0;
    hooksAll[when][type].push({
      constructor: hook,
      inlineConfig: inlineConfig
    });
  });
};

/**
 * Applies all registered ALL hooks to provided resource.
 * All hooks enabled by default.
 * You can disable specific hook in resource definition.
 * @param resource - resource configuration object
 * @param fortuneConfig - fortune configuration object
 */
exports.initGlobalHooks = function(resource, fortuneConfig){
  resource.hooks = resource.hooks || {};
  //Iterates before and after hooks
  _.each(hooksAll, function(timeHooks, when){
    var stageHook = resource.hooks[when] = resource.hooks[when] || {};
    //Iterates read and write hooks
    _.each(timeHooks, function(typeHooks, type){
      var typeHook = stageHook[type] = stageHook[type] || [];
      //Iterates over registered hooks scoped to before/after, read/write
      _.each(_.sortBy(typeHooks, function(i){return i.constructor.priority}), function(hook){
        var hookConfig = getHookConfig(hook.constructor, resource, hook.inlineConfig);
        if (!hookConfig.disable) {
          var fn = hook.constructor.init(hookConfig, fortuneConfig);
          fn._priority = hook.constructor.priority || 0;
          typeHook.unshift(fn);
        }
      });
    });
  });
};

exports.addHook = function(name, hooks, stage, type, inlineConfig){
  var _this = this;

  if (typeof name === 'function') {
    hooks = name;
    name = this._resource;
  }

  name.split(' ').forEach(function(resourceName) {
    hooks = normalize(hooks);
    var resource = _this._resources[resourceName];
    if (!resource){
      return console.warn('You are trying to attach a hook to %s, ' +
        'that is not defined in this instance of fortune', resourceName);
    }
    resource.hooks = resource.hooks || {};
    resource.hooks[stage] = resource.hooks[stage] || {};
    resource.hooks[stage][type] = resource.hooks[stage][type] || [];
    _.each(hooks, function(hook){
      var hookOptions = getHookConfig(hook, resource, inlineConfig);
      var fn = hook.init(hookOptions, _this);
      fn._priority = hook.priority || 0;
      resource.hooks[stage][type].push(fn);
    });
    resource.hooks[stage][type] = _.sortBy(resource.hooks[stage][type], function(h){return -h._priority});
  });
};

/**
 * Backward compatibility method.
 * Accepts array or function and return array of constructor objects.
 * @param hookFunction
 * @returns {Array}
 */
function normalize(hookFunction){
  if (!_.isArray(hookFunction)){
    var clone = _.clone(hookFunction);
    var tmp = {};
    if (_.isFunction(hookFunction)){
      tmp.init = function(){
        return clone;
      };
      //This name should be unique somehow O_o
      tmp.name = crypto.createHash('md5').update(hookFunction.toString()).digest('hex');
      tmp.config = {};
    }
    return [tmp];
  }else{
    return hookFunction;
  }
}

/**
 *
 * @param hook - normalized hook constructor
 * @param resource - resource object
 * @param inlineConfig - object that is passed along with hook
 */

function getHookConfig(hook, resource, inlineConfig){
  var config = {};
  var inline = (inlineConfig || {})[hook.name] || {};
  var hookConfig = _.cloneDeep(hook.config) || {};
  if (resource.hooksOptions){
    if (resource.hooksOptions[hook.name]){
      config = _.extend(hookConfig, inline, resource.hooksOptions[hook.name]);
    }else{
      config = _.extend(hookConfig, inline);
    }
  }else{
   config = _.extend(hookConfig, inline);
  }
  return config;
}

/**
 *
 * @param hook
 * @param config
 */
function matchConfig(hook, config){
  if (!hook.name || !config) return hook.config || {};
  var hookName = hook.name;
  var defaultConfig = _.extend({}, hook.config);
  var newConfig = config[hookName] || {};
  return _.extend(defaultConfig, newConfig);
}
