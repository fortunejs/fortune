var RSVP = require('rsvp');
var _ = require('lodash');
var crypto = require('crypto');

var hooksAll = exports._hooksAll = {
  before:{
    read: {}
  },
  after: {
    write: {}
  }
};

/**
 * For internal use by fortune in beforeAll/afterAll
 * @param when
 * @param type
 * @param provider - Array of hooks. name and init props are required
 */
exports.registerGlobalHook = function(when, type, provider){
  //TODO: Do not allow to overwrite hooks???
  provider.forEach(function(hook){
    hooksAll[when][type][hook.name] = hook;
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
    var hookWhen = resource.hooks[when] = resource.hooks[when] || {};
    //Iterates read and write hooks
    _.each(timeHooks, function(typeHooks, type){
      var hookType = hookWhen[type] = hookWhen[type] || {};
      //Iterates over registered hooks scoped to before/after, read/write
      _.each(typeHooks, function(hook, name){
        var hookConfig = getHookConfig(hook, resource);
        if (!hookConfig.disable) {
          hookType[name] = hook.init(fortuneConfig, hookConfig);
        }
      });
    });
  });
};

/**
 * Internal method to add transforms on a resource.
 *
 * @api private
 * @param {String} name
 * @param {Function} fn
 * @param {String} stage
 */
exports._addTransform = function(fortune, name, fn, stage){
  var _this = fortune;

  if (typeof name === 'function') {
    fn = name;
    name = fortune._resource;
  }
  //take hook options from resource
  var resource = fortune._resources[name];
  if(typeof fn === 'function') {
    /**
     * key - resource name
     */
    name.split(' ').forEach(function(key) {
      _this[stage][key] = _this[stage][key] || [];
      _this[stage][key].push(fn);
    });
  }
};

exports.addHook = function(name, hooks, stage, type){
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
    resource.hooks[stage][type] = resource.hooks[stage][type] || {};
    _.each(hooks, function(hook){
      var hookOptions = getHookConfig(hook, resource);
      resource.hooks[stage][type][hook.name] = hook.init(_this.options, hookOptions);
    });
  });
};

/**
 * Backward compatibility method.
 * Accepts array of function and return array of constructor objects.
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
 */
function getHookConfig(hook, resource){
  var config = {};
  if (resource.hooksOptions){
    if (resource.hooksOptions[hook.name]){
      config = resource.hooksOptions[hook.name];
    }else{
      config = hook.config || {};
    }
  }else{
   config = hook.config || {};
  }
  return config;
}
