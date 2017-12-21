var RSVP = require("rsvp"),
    _ = require("lodash");

module.exports = function(){
  var handlers = {};

  var createRequest = function(collection, opt, httpMethod){
    return _.extend(opt, {
      direct: true,
      method: httpMethod,
      headers: _.extend({
        "content-type": "application/json"
      }, opt.headers),
      get: function(h){ return this.headers[h]; },
      set: function(key,val){ this.headers[key] = val},
      fortune: {requestMetadata: {direct: true}},
      query: opt.query || {},
      params: opt.params || {},
      path: '/' + ((opt.params && opt.params.id) ? collection + '/' + opt.params.id : collection)
    });
  };

  var createResponse = function(){
    var deferred = RSVP.defer(),
        res = {
          headers: {},
          set: function(key,val){ this.headers[key] = val; },
          get: function(h){ return this.headers[h]},
          setHeader: function(key,val){this.set(key,val);},
          status: function(){return this;}, //it's not used anywhere
          send: function(body){
            deferred.resolve(_.extend({
              body: body && JSON.parse(body)
            }, res));
          },
          promise: deferred.promise
        };

    return res;
  };

  var asSingleOrCollection = function(method, collection, options, httpMethod){
    var req, res,
        methodName = (options.params || {}).id ? method : (method + "All");

    handlers[collection][methodName](req = createRequest(collection, options, httpMethod), res = createResponse());

    return res.promise;
  };

  return {
    _createRequest: createRequest,
    _createResponse: createResponse,
    methods: {
      create: function(collection, options){
        var req, res;

        options.body = _.cloneDeep(options.body);

        handlers[collection].create(req = createRequest(collection, options, "POST"),res = createResponse());

        return res.promise;
      },
      get: function(collection,options){
        return asSingleOrCollection("get", collection, options || {}, "GET");
      },
      destroy: function(collection,options){
        return asSingleOrCollection("destroy", collection, options || {}, "DELETE");
      },
      replace: function(collection, options){
        var req,res;

        options.body = _.cloneDeep(options.body);
        
        handlers[collection].replace(req = createRequest(collection, options, "PUT"), res = createResponse());
        return res.promise;
      },
      update: function(collection, options){
        var req, res;

        options.body = _.cloneDeep(options.body);

        handlers[collection].update(req = createRequest(collection, options, "PATCH"), res = createResponse());

        return res.promise;
      }, 
      callAction: function(collection, method, options){
        var req, res;
        
        options.body = _.cloneDeep(options.body);
        handlers[collection].callAction(req = createRequest(collection, options, method), res = createResponse());

        return res.promise;
      }, 
      callGenericAction: function(collection, method, options){
        var req, res;
        
        options.body = _.cloneDeep(options.body);
        handlers[collection].callGenericAction(req = createRequest(collection, options, method), res = createResponse());

        return res.promise;
      }
    },
    registerResource: function(collection, callbacks){ 
      var handlerNames = [ "create", "update", "replace", "destroy", "destroyAll", "get", "getAll", "callAction", "callGenericAction"];
      if(!_.isEqual(_.keys(callbacks), handlerNames)){
        throw new Error("Wrong route handler names");
      }
      handlers[collection] = callbacks;
    }
  };
};
