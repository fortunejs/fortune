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
 */
exports.registerGlobalHook = function(when, type, provider){
  provider.forEach(function(hook){
    hooksAll[when][type].push(hook);
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
      _.each(typeHooks, function(hook, name){
        var hookConfig = getHookConfig(hook, resource);
        if (!hookConfig.disable) {
          typeHook.unshift(hook.init(hookConfig, fortuneConfig));
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
    resource.hooks = resource.hooks || {};
    resource.hooks[stage] = resource.hooks[stage] || {};
    resource.hooks[stage][type] = resource.hooks[stage][type] || [];
    _.each(hooks, function(hook){
      var hookOptions = getHookConfig(hook, resource, inlineConfig);
      resource.hooks[stage][type].push(hook.init(hookOptions, _this.options));
    });
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
  var hookConfig = _.clone(hook.config) || {};
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
