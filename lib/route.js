var RSVP = require('rsvp')
  , qs = require('qs')
  , _ = require('lodash')
  , LinkingBooster = require('./linking-booster')
  , routeHelpers = require('./route-helpers')
  , actionModule = require('./actions')
  , sift = require('sift');


// constants
var MIME = {
  standard: ['application/vnd.api+json', 'application/json'],
  patch: ['application/json-patch+json']
},
    errorMessages = {
      400: 'Request was malformed.',
      403: 'Access forbidden.',
      404: 'Resource not found.',
      405: 'Method not permitted.',
      412: 'Request header "Content-Type" must be one of: ' + MIME.standard.join(', '),
      500: 'Oops, something went wrong.',
      501: 'Feature not implemented.'
    };


/**
 * Setup routes for a resource, given a name and model.
 *
 * @param {String} name
 * @param {Object} model
 * @param {Object} resources - a list with all registered resources
 * @param {Object} inflect
 * @param {Object} querytree
 */
function route(name, model, resources, inflect, querytree, metadataProviders) {
  var ROUTE_TYPES = this.constants.ROUTE_TYPES;
  var _this = this
    , router = this.router
    , adapter = this.adapter
    , director = this.director
    , booster = LinkingBooster.init(this.director, inflect, resources)

    // options
    , baseUrl = this.options.baseUrl
    , namespace = this.options.namespace
    , suffix = this.options.suffix
    , production = this.options.production
    , instrumentorObj = this.options.customInstrumentorObj
    , instrumentor = this.options.customInstrumentorObj.instrumentor

    // routes
    , collection = inflect.pluralize(name)
    , collectionRoute = namespace + '/' + collection + suffix
    , individualRoute = namespace + '/' + collection + '/:id' + suffix

    //Calls custom action set up on resource. :action is a verb
    //OR looks up linked resources for individual route. :key is an noun and no matching action was found
    , actionRoute = namespace + '/' + collection + '/:id/:key' + suffix
    , genericActionRoute = namespace + '/' + collection + '/action/:action' + suffix
  ;

  var options = this.options;

  this.director.registerResource(collection,{
    create: createResource,
    update: updateResource,
    replace: replaceResource,
    destroy: deleteResource,
    destroyAll: deleteResources,
    get: getResource,
    getAll: getResources, 
    callAction: callAction, 
    callGenericAction: callGenericAction
  });

  //Init linker-booster after director is set up

  // response emitters
  var sendError = function (req, res, status, error) {
    if (!!error && status !== 400) console.trace(error.stack || error);
    if (error) console.trace(error.stack || error);
    var object = {
      error: errorMessages[status],
      detail: error ? error.toString() : ''
    }, str = production ?
          JSON.stringify(object, null, null) :
          JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[1]);
    res.status(status);
    res.send(str);
  };

  var beforeResponseHook = Hook('_before', 'response');
  var sendResponse = function (req, res, status, object) {
    try{

    if (status === 204) return res.status(status).send();
    }catch(e){
      console.error(e);
    }

    object = object || {};
    var linked;
    if (req.linker){
      linked = appendLinks.call(_this, object, req, res).then(function(body){
        return booster.mergeResults(req, req.linker, body);
      });
    }else {
      linked = appendLinks.call(_this, object, req, res);
    }

    linked
      .then(function(object){
        var includeMeta = req.query.includeMeta && !_.isBoolean(req.query.includeMeta) && _.without(req.query.includeMeta.split(','), 'count', 'true');
        if (!includeMeta || !includeMeta.length) return object;
        object.meta = object.meta || {};
        return RSVP.all(_.map(includeMeta, function(metaKey){
          if (!metadataProviders[metaKey]) {
            object.meta[metaKey] = 'Metadata provider is not defined';
            return null;
          }
          var tmp = metadataProviders[metaKey].call(object, req, res);
          var promise = tmp.then ? tmp : new RSVP.Promise(function(r){ r(tmp)});
          return promise.then(function(value){
            object.meta[metaKey] = value;
          });
        })).then(function(){
          return object;
        });
      })
      .then(function(object) {
        beforeResponseHook(object, req, res).then(function(transform){
          var object, statusCode;
          if (_.keys(transform).length === 2 && _.has(transform, 'statusCode') && _.has(transform, 'body')){
            object = transform.body;
            statusCode = transform.statusCode || status;
          }else{
            object = transform;
            statusCode = status;
          }
          var str = production ?
                JSON.stringify(object, null, null) :
                JSON.stringify(object, null, 2) + '\n';

          res.set('Content-Type', !req.get('User-Agent') ? MIME.standard[0] : MIME.standard[1]);

          res.status(statusCode);
          res.send(str);
        });
    }).catch(function(err){ console.trace(err.stack || err); throw err; });
  };
  var methodNotAllowed = function (req, res) {
    sendError(req, res, 405);
  };

  var beforeReadHook = Hook('_before', 'read');
  var beforeWriteHook = Hook('_before', 'write');
  var afterReadHook = Hook('_after', 'read');
  var afterWriteHook = Hook('_after', 'write');

  function filterHooks(hooks, time, type, resource, name){
    var ary = hooks[time][type];
    return _.reduce(_this._hookFilters, function(memo, filter){
      return filter(memo, name, time.replace('_', ''), type, resource)
    }, ary);
  }

  function Hook(time, type){
    return function(model, resource, request, response, isNew){
      if (_.isUndefined(response) || _.isNull(response)) {
        response = request;
        request = resource;
        resource = model;
        model = name;
      }
      var tracePrefix = instrumentorObj.options.tracePrefix + model + " - " + time +  '-hooks';
      return new RSVP.Promise(
          instrumentor.createTracer( tracePrefix,  function(resolve, reject){
        //If no transforms found for this resource return without change

        var hooks = resources[model].hooks;
        if (!hooks[time] || !hooks[time][type]) return resolve(resource);
        resource = _.extend(resource, isNew);
        var transform = resource;
        _.each(filterHooks(hooks, time, type, resource, name), function(h){
          var fn = h.fn;
          if (transform){
            if (transform.then){
              transform = transform.then(function(data){
                if (data === false) return false;
                return fn.call(data, request, response);
              });
            }else{
              transform = fn.call(transform, request, response);
            }
          }
        });
        if (!transform && transform !== false) return reject();
        if(transform.done){
          transform.done(resolve, reject);
        }else{
          resolve(transform);
        }
      }));
    };
  }

  var mimeCheck = function (contentType) {
    return ~MIME.standard.indexOf(contentType.split(';').shift());
  };

  /*!
   * Handle creating a resource.
   */
  router.post(collectionRoute, createResource);

  function createResource(req, res){
    if (!mimeCheck(req.get('content-type'))){
      return sendError(req, res, 412);
    }
    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.createResource,
      resource: collection
    });

    var inclusions = [];
    var mainResources = _.clone(req.body[collection]);

    if (req.body.linked){
      //Run all befores before mapping main to linked resources ids
      var linkedBefores = {};
      _.each(omitExternal(req.body.linked), function(linkedResources, key){
        linkedBefores[key] = function(){return runBefores(inflect.singularize(key), linkedResources)};
      });
      runBefores(model.modelName || model, mainResources)
        .then(function(mainTransform){
          if (_.isUndefined(mainTransform)) return;
          return RSVP.hash({
            mainResources: mainTransform,
            linkedResources: RSVP.hash(_.reduce(linkedBefores, function(memo, fn, key){memo[key] = fn();return memo;}, {}))
          });
        })
        .then(function(transformed){
          //Check if any before hook returned false
          if (_.isUndefined(transformed)) return;
          if (hooksFailed(
            _.flatten(_.values(transformed.linkedResources), true)
          )) return;

          //Now when all hooks succeeded it's safe to create resources
          var refsFromMain = getAssociations.call(_this, _this._schema[inflect.singularize(collection)]);
          var matchedMainResources = flattenLinks(transformed.mainResources);
          _.each(transformed.linkedResources, function (linkedResources, key) {
            var singularKey = options.inflect ? inflect.singularize(key) : key;
            //Find related paths from main resource to linked doc
            var refPaths = _.filter(refsFromMain, function(ref){
              return ref.type === key;
            });
            //Map linked ids to main resources fields
            //As linkedResources is always of different type it's safe to overwrite matchedMainResource
            matchedMainResources = _.map(matchedMainResources, function(resource){
              _.each(refPaths, function(path){
                if (inclusions.indexOf(path.key) === -1) inclusions.push(path.key);
                resource[path.key] = mix(resource[path.key], linkedResources, singularKey);
              });
              return resource;
            });
          });
          //Convert main resource to single promise
          return RSVP.all(_.map(matchedMainResources, function(r){
            return RSVP.hash(r);
          }));
        })
        .then(function(mappedMainResources){
          return createResources(model, mappedMainResources);
        }).then(respond);

    }else{
      runBefores(model.modelName, mainResources)
        .then(function(transformed){
          if (hooksFailed(transformed)) return;
          return transformed;
        })
        .then(function(resources){
          return createResources(model, resources)
        })
        .then(respond);
    }

    function flattenLinks(resources){
      return _.map(resources, function(item){
        return _.omit(_.extend({}, item, item.links), 'links');
      });
    }

    function omitExternal(linked){
      var refsFromMain = getAssociations.call(_this, _this._schema[inflect.singularize(collection)]);
      var local = {};
      _.each(refsFromMain, function(ref){
        if (linked[ref.type] && !ref.external) local[ref.type] = linked[ref.type]
      });
      return local;
    }

    function hooksFailed(resources){
      return (_.some(resources, function(res) {
        return _.isUndefined(res);
      }));
    }

    function terminateOnRejectedHooks(resources){
      if (_.some(resources, function(res) {
        return _.isBoolean(res) && res == false;
      })) {
        console.log('Terminating request due to a transform returning false');
        return;
      }else{
        return resources;
      }
    }

    function runBefores(modelName, resources){
      var before = [];
      resources.forEach(function(resource) {
        if(modelName) {
          before.push(beforeWriteHook(modelName, resource, req, res, {__isNew: true}));
        }
      });
      return RSVP.all(before)
        .then(terminateOnRejectedHooks, function(errors) {
          console.log(errors.stack);
          if (!res.headerSent) sendError(req, res, 403, errors);
        });
    }

    /**
     * should substitute client-generated ids in main with promises of linked ids
     * @param main - array with client-generated ids
     * @param linked - array with linked documents
     * @param linkedModel - name of related model
     */
    function mix(main, linked, linkedModel){
      if (!main){
        //Main document does not specify which linked docs to pick. Create all linked documents and reference them from main
        return RSVP.all(_.map(linked, function(l){
          return createLinked(linkedModel, l);
        }));
      }else{
        //Main is defined but could mix existing resources and those to create
        return RSVP.all(_.map(_.isArray(main) ? main : [main], function(item){
          var toCreate = _.find(linked, function(l){
            return _.has(l, 'id') && l.id === item;
          });
          if (!toCreate) return item;
          return createLinked(linkedModel, _.omit(toCreate, 'id'));
        }));
      }
    }

    /**
     * Creates single linked resource
     * @param linkedModel
     * @param linkedResource
     */
    function createLinked(linkedModel, linkedResource){
      return createResources(linkedModel, [linkedResource])
        .then(function(resources){
          return resources[0].id;
        });
    }


    /**
     * Creates all provided resources and returns them
     * Expects that `before` hooks were run already
     * @param model
     * @param resources
     * @returns {*}
     */
    function createResources(model, resources){
      if (!resources) return;
      var modelName = model.modelName || model;

      //Before transforms are done by this time
      // create the resources
      return RSVP.all(resources.map(function(resource) {
        return adapter.create(model, resource);
      }))
      // do after transforms
        .then(function(resources) {
          if (!resources) return;
          return RSVP.all(resources.map(function(resource) {
            return afterWriteHook(modelName, resource, req, res);
          })).then(terminateOnRejectedHooks);
        }, function(error) {
          sendError(req, res, 500, error);
        });
    }

    /**
     * Sends final response to the client if all goes well
     * @param primaryResources
     * @returns {}
     */
    function respond(primaryResources){
      if (!primaryResources) return;
      if(!primaryResources.length) {
        return sendResponse(req, res, 204);
      }
      var body = {};

      if(!!baseUrl) {
        var location = baseUrl + '/';
        location += !!namespace ? namespace + '/' : '';
        location += collection + '/' + primaryResources.map(function(resource) {
          return resource.id;
        }).join(',');
        res.set('Location', location);
      }

      body[collection] = primaryResources;
      if (inclusions.length !== 0){
        //Mix requested include and created linked resources keys to reuse mergeLinked and fetch persisted linked docs
        req.query.include = req.query.include ?
          req.query.include += ',' + inclusions.join(',') :
          inclusions.join(',')
      }

      sendResponse(req, res, 201, body);
    }
  }

  /*
   * Get a list of resources.
   */

 router.get(collectionRoute, getResources);

  if (this.options.enableWebsockets){
    //Websockets handshake should pass through same hooks pipeline so that we are able to set
    //restrictive query with fortune-security and run any other request validation
    this.io.of(collectionRoute).use(function(socket, next){
      var req = director._createRequest(inflect.pluralize(name), {
        //socket.io client doesn't work well if complex queries like ?filter[prop]=value so parsing it here
        query: qs.parse(_.clone(socket.client.request._query))
      });
      var res = director._createResponse();
      res.send = function(message){
        //Handling hook interruption. Only error is "possible" here
        next(new Error(message));
      };
      beforeReadHook({}, req, res)
        .then(function(result){
          if (_.isBoolean(result) && result === false) return; //next called from aborted hook
          socket.handshake.fortuneQuery = _.clone(req.query);
          next();
        });
    });
  }

  function getResources(req, res) {
    var match = {};
    var ids = [];
    var projection = {};
    var select = parseSelectProjection(req.query.fields, inflect.pluralize(model.modelName));
    var tracePrefix = instrumentorObj.options.tracePrefix + '/' + model.modelName;

    req.query.fortuneExtensions = [{}]; //Must be a non-empty array in case no hook modifies it
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.getResources,
      resource: collection
    });

    if(req.query.ids) match.id = {$in: req.query.ids.split(',')};

    //run beforeRead
    beforeReadHook({}, req, res)
      .then(  instrumentor.createTracer( tracePrefix + ' parse', function(){

        req.query.filter = {
          $and: [
            req.query.filter
          ].concat(req.query.fortuneExtensions)
        };

        if (select){
          projection = {
            select: select
          };
        }
        if (!_.isUndefined(req.query.limit)){//why's there no isDefined
          projection.limit = parseInt(req.query.limit,10);
        }
        if (req.query.sort){
          projection.sort = req.query.sort;
        }
        else if(model.schema.options.defaultSort){
          projection.sort = model.schema.options.defaultSort;
        }
        if (req.query.page){
          projection.page = req.query.page;
          if (req.query.pageSize){
            projection.pageSize = parseInt(req.query.pageSize);
          }
          else {
            projection.pageSize = 10;
          }
        }
        if (!_.isUndefined(req.query.includeDeleted)){
          projection.includeDeleted = true;
        }
        //if limit is zero we just don't set it. (or use the default if exists)
        if(!_.isNumber(projection.limit)){
          projection.limit =  model.schema.options.defaultLimit;
        }

        // get resources by IDs
        return querytree.parse(req, model.modelName, _.extend(match, req.query.filter))
          .then( instrumentor.createTracer( tracePrefix + ' read', function(query){
            var queries = {};
            queries.resources = adapter.findMany(model, query, projection);

            if(req.query.includeMeta && (_.isBoolean(req.query.includeMeta) || req.query.includeMeta.split(',').indexOf('count') !== -1 || req.query.includeMeta.split(',').indexOf('true') !== -1)) {
              //Count all resources that service would potentially allow to read
              if (process.env.DISASTER_RECOVERY_COUNT_ENABLED){
                queries.count = adapter.count(model, {$and: req.query.fortuneExtensions}, projection);
              }else{
                queries.count = new RSVP.resolve(1);
              }

              if (req.query.filter) {
                queries.filterCount = adapter.count(model, query, projection);
              }
            }
            return RSVP.hash(queries);
          }));
      }))
      // run after read
      .then( instrumentor.createTracer( tracePrefix + ' response-preparation', function(result) {
        return RSVP.all(result.resources.map( function(resource) {
          return afterReadHook(resource, req, res);
        }))
        .then(function(r) {
          result.resources = r;
          return result;
        });
      }))
      // send the response
      .then( instrumentor.createTracer( tracePrefix + ' sending-response', function(r) {
        var body = {};
        body[collection] = r.resources;

        if (!_.isUndefined(r.count)) {
          body.meta = { count : r.count };
          if (!_.isUndefined(r.filterCount)) body.meta.filterCount = r.filterCount;
        }
        sendResponse(req, res, 200, body);
      })).catch(function(error) {
        var status = error.constructor.name === "CastError" || error.message.match(/^Cast/) ? 400 : 500;
        sendError(req, res, status, error);
      });
  }

  /*
   * Handle unsupported methods on a collection of resources.
   */
  router.put(collectionRoute, methodNotAllowed);
  router.patch(collectionRoute, methodNotAllowed);

  /*
   * Get an individual resource, or many.
   */
  router.get(individualRoute, getResource);

  function getResource(req, res) {
    var match = {};
    var ids = req.params.id.split(',');
    var projection = {};

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.getResource,
      resource: collection
    });

    if (booster.canBoost(req)){
      req.linker = booster.startLinking(req);
    }
    var select = parseSelectProjection(req.query.fields, inflect.pluralize(model.modelName));

    if (select){
      projection = {
        select: select
      }
    }

    if (req.query.includeDeleted){
      projection.includeDeleted = true;
    }

    if(model.schema.options.defaultSort){
      projection = projection || {};
      projection.sort = model.schema.options.defaultSort;
    }

    if(ids){
      req.query.filter = req.query.filter || {};
      if (ids.length === 1){
        req.query.filter.id = ids[0];
      }else{
        req.query.filter.id = {$in: ids};
      }
    }
    //run before read
    beforeReadHook({}, req, res)
      .then(function() {
        // get resources by IDs
        match = {
          $and: [
            req.query.filter
          ].concat(req.query.fortuneExtensions)
        };
        return adapter.findMany(model, match, projection);
      }).catch(function(err) {
        sendError(req, res, 500, err);
      })

    // run after read hook
      .then(function(resources) {
        if(resources.length) {
          return RSVP.all(resources.map(function(resource) {
            return afterReadHook(resource, req, res);
          }));
        } else {
          var notRestricted = (req.query.fortuneExtensions.length === 0) ||
            req.query.fortuneExtensions.every(function(el){return Object.keys(el).length === 0});
          if (req.query.includeDeleted && notRestricted){// the list includes all available docs
            console.log("the list includes all available docs");
            sendError(req, res, 404);
          }else{
            var projectionWithDeleted = _.clone(projection);
            projectionWithDeleted.includeDeleted = true;
            var lessRestrictiveFilter = _.clone(req.query.filter);

            // for efficiency reasons, if more than one doc is requested, the response code depends  on the first doc's state only
            if(ids && (ids.length > 1)) {
              lessRestrictiveFilter.id = ids[0];
            }
            adapter.findMany(model, {$and: [lessRestrictiveFilter]}, projectionWithDeleted).then(function (resources) {
              if (resources.length) {
                sendError(req, res, (sift({$and: req.query.fortuneExtensions}, resources).length>0) ? 410 : 403);
              } else {
                sendError(req, res, 404);
              }
            })
          }
        }
      }, function(error) {
        sendError(req, res, 500, error);
      })

    // send the response
      .then(function(resources) {
        if (!resources) return;
        var body = {};
        body[collection] = resources;
        sendResponse(req, res, 200, body);
      }, function(error) {
        sendError(req, res, 500, error);
      });
  }

  /*
   * Get the related resources of an individual resource.
   * Called if request.method is GET and no matching action was found
   */

  function getSubresources(req, res) {
    var id = req.params.id,
        key = req.params.key,
        originalFilter = req.query.filter ? _.cloneDeep(req.query.filter) : {};

    var projection = {};
    var select = parseSelectProjection(req.query.fields, model.modelName);

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.getSubresources,
      resource: collection,
      subResourcePath: key
    });
    if (select){
      projection = {
        select: select
      };
    }

    if (!_.isUndefined(req.query.limit)){
      projection.limit = parseInt(req.query.limit,10);
    }

    if(id){
      //Reset query.filter to value applied to primary resource
      req.query.filter = {};
      req.query.filter.id = id;
    }

    beforeReadHook({}, req, res)
      .then(function(){
        // get a resource by ID
        return adapter.find(model, req.query.filter, projection);
      }, function(err){
        sendError(req, res, 500, err);
      })

    // run after read hook
      .then(function(resource) {
        return afterReadHook(resource, req, res);
      }, function(error) {
        sendError(req, res, 404, error);
      })

    // change context to resource
      .then(function(resource) {
        var ids, relatedModel;
        try {
          ids = resource.links[key];
          if (_.isUndefined(ids)) {
            ids = [];
          }
          ids = _.isArray(ids) ? ids : [ids];
          relatedModel = _this._schema[name][key];
          relatedModel = _.isArray(relatedModel) ? relatedModel[0] : relatedModel;
          relatedModel = _.isPlainObject(relatedModel) ? relatedModel.ref : relatedModel;
          if (key && key.length > 0 && !relatedModel) {
            return sendError(req, res, 404);
          }
        } catch(error) {
          return sendError(req, res, 404, error);
        }

        var findPromise;
        if (_.size(ids) > 0) {
          //Reset req.query.filter to original value discarding changes applied for parent resource
          req.query.filter = originalFilter;
          req.query.filter.id = {$in: ids};
          //run before read hook
          findPromise = beforeReadHook(relatedModel, {}, req, res)
            .then(function(){
              // find related resources
              return adapter.findMany(relatedModel,
                                      req.query.filter,
                                      _.isNumber(projection.limit) ? projection.limit : undefined);
            }, function(err){
              sendError(req, res, 500, err);
            });
        } else {
          var deferred = RSVP.defer();
          deferred.resolve([]);
          findPromise = deferred.promise;
        }

        // do after transforms
        findPromise.then(function(resources) {
          return RSVP.all(resources.map(function(resource) {
            return afterReadHook(relatedModel, resource, req, res);
          }));
        }, function(error) {
          sendError(req, res, 500, error);
        })

        // send the response
          .then(function(resources) {
            var body = {};
            body[inflect.pluralize(relatedModel)] = resources;
            sendResponse(req, res, 200, body);
          }, function(error) {
            sendError(req, res, 403, error);
          });

      }, function(error) {
        sendError(req, res, 403, error);
      });
  }

  /*
   * Put a resource.
   */
  router.put(individualRoute, replaceResource);

  function replaceResource(req, res) {
    var id = req.params.id;
    var update;

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.replaceResource,
      resource: collection
    });

    try {
      update = req.body[collection][0];
      if (!update) return sendError(req, res, 400);
    } catch(error) {
      return sendError(req, res, 400, error);
    }


    // try to find the resource by ID
    adapter.find(model, id).then(function() {
        // do before write hook
        beforeWriteHook(update, req, res)

        // update the resource
          .then(function(update) {
            if (_.isBoolean(update) && update === false) return;
            var match = adapter.preupdate(model, id);
            return adapter.update(model, match, update);
          }, function(error) {
            sendError(req, res, 403, error);
          })

        // do after transform
          .then(function(update) {
            if (!update) return;
            return afterWriteHook(update, req, res);
          }, function(error) {
            sendError(req, res, 500, error);
          })

        // send the response
          .then(function(update) {
            if (!update) return;
            var body = {};
            body[collection] = [update];
            sendResponse(req, res, 200, body);
          }, function(error) {
            sendError(req, res, 403, error);
          });

      },

            // resource not found, try to create it
            function() {

              // do before transform
              beforeWriteHook(update, req, res, null, {__isNew: true})

              // create the resource
                .then(function(resource) {
                  return adapter.create(model, id, resource);
                }, function(error) {
                  sendError(req, res, 403, error);
                })

              // do after transform
                .then(function(resource) {
                  return afterWriteHook(resource, req, res);
                }, function(error) {
                  sendError(req, res, 500, error);
                })

              // send the response
                .then(function(resource) {
                  var body = {};
                  body[collection] = [resource];
                  sendResponse(req, res, 201, body);
                }, function(error) {
                  sendError(req, res, 500, error);
                });

            });
  }


  /*
   * Delete a collection
   */

  router.delete(collectionRoute, deleteResources);

  function deleteResources(req,res){
    var destroy = !!req.query.destroy;

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.deleteResources,
      resource: collection
    });

    adapter.findMany(model)

      .then(function(resources){
        return RSVP.all(_.map(resources,function(resource){
          return beforeWriteHook(resource, req, res);
        }));
      }, function(err){
        sendError(req,res, 404, err);
      })
      .then(function(){
        if (destroy) return adapter.delete(model);

        return adapter.findMany(model, {}).then(function(data){
          return RSVP.all(_.map(data, function(item){
            return adapter.markDeleted(model, item.id);
          }));
        });
      }, function(err){
        sendError(req, res, 500, err);
      })

      .then(function(resources){
        return RSVP.all(_.map(resources, function(resource){
          return afterWriteHook(resource, req, res);
        }));
      }, function(err){
        sendError(req, res, 500, err);
      })

      .then(function(){
        sendResponse(req,res,204);
      }, function(err){
        sendError(req,res,500,err);
      });
  }

  /*
   * Delete a resource.
   */
  router.delete(individualRoute, deleteResource);

  function deleteResource(req, res) {
    var id = req.params.id.split(',');
    var destroy = !!req.query.destroy;

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.deleteResource,
      resource: collection
    });

    var projection = {};
    if (destroy) projection.includeDeleted = true;
    // find the resource by ID
    adapter.findMany(model, id, projection).then(function(resources) {
        if (resources.length === 0) return sendError(req, res, 404);
        return RSVP.all(_.map(resources, function(resource){
          return beforeWriteHook(resource, req, res);
        }));
      }).catch(function(error) {
        sendError(req, res, 404, error);
      })

    // let's delete it (or only mark deleted by )
      .then(function(resources) {
        if (_.isUndefined(resources) || _.some(resources, function(r){return _.isBoolean(r) && r === false})) return;
        return destroy ? adapter.delete(model, id) : adapter.markDeleted(model, id);
      }).catch(function(error) { // resource not found
        sendError(req, res, 404, error);
      })

      .then(function(resources){
        if (!resources) return;
        return RSVP.all(_.map(resources, function(resource){
          return afterWriteHook(resource, req, res);
        }));
      }).catch(function(err){
        sendError(req, res, 500, err);
      })

      .then(function(resource) {
        if (!resource) return;
        sendResponse(req, res, 204);
      }).catch(function(error) {
        sendError(req, res, 500, error);
      });
  }

  /*
   * Patch a resource.
   */
  router.patch(individualRoute, updateResource);

  function updateResource(req, res) {
    var id = req.params.id;
    var updates = [];

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    req.query.fortuneExtensions = [{}];
    req.fortune.routeMetadata = _.extend({}, req.fortune.routeMetadata, {
      type: ROUTE_TYPES.updateResource,
      resource: collection
    });

    var project = {};

    if (req.query.includeDeleted) {
      project.includeDeleted = true;
    }
    //Try to find  document
    adapter.find(model, id, project)
    .then(function( returnedDocument ){
        // do before transform
      try {
        // parse patch request, only 'replace' op is supported per the json-api spec
        updates = routeHelpers.buildPatchOperations(model, returnedDocument, req.body);
      } catch(error) {
        console.log( error );
        return sendError(req, res, 400, error);
      }
      return RSVP.all(updates.map(function(update){
        //Pass only the part representing actual change to the hooks
        return RSVP.hash({
          match: update.match,
          update: beforeWriteHook(update.update, req, res)
        });
      }));
    }, function(error){
      sendError(req, res, 404, error);
    })

    .then(terminateOnRejectedHooks)

    // update the resource
    .then(function(updates) {
      if (!updates) return;
      var chain = RSVP.resolve();
      updates.forEach(function(update){
        chain = chain.then(function(prev){
          var match = adapter.preupdate(model, id);
          return adapter.update(model, {$and: [update.match, match]}, update.update)
            .then(function(recent){
              //sometimes recent might be null. try returning previous value instead
              return recent || prev;
            });
        });
      });
      return chain;
    }, function(error) {
      sendError(req, res, 403, error);
    })

    // do after transform
    .then(function(resource) {
      if (!resource) return;
      return afterWriteHook(resource, req, res);
    }, function(error) {
      sendError(req, res, 500, error);
    })

    // send the response
    .then(function(resource) {
      if (!resource) return;
      var body = {};
      body[collection] = [resource];
      sendResponse(req, res, 200, body);
    }, function(error) {
      sendError(req, res, 500, error);
    });

    function terminateOnRejectedHooks(updates){
      if (_.some(updates, function(update) {
        return _.isBoolean(update.update) && update.update == false;
      })) {
        console.log('Terminating PATCH request due to a transform returning false');
        return;
      }else{
        return updates;
      }
    }
  }

  /*
   * POSTing a resource to a predetermined ID is not allowed,
   * since that is what PUT is for.
   */
  router.post(individualRoute, methodNotAllowed);

  /*
   * GET a resource action
   */
  router.all(genericActionRoute, callGenericAction);

  router.all(actionRoute, callAction);

  function callAction(req, res) {
    var action = _this.actions.getAction(name, req.params.key, req.method);
    if (!action && req.method === "GET") return getSubresources(req, res); //No action matched - try subresource route
    if (!action) return sendError(req, res, 404);
    if (action.method && action.method !== req.method) return sendError(req, res, 405);

    _this.direct.get(collection, req)
      .then(function(result){
        var docs = result.body[collection];
        return RSVP.all(_.map(docs, function(doc){
          var params = {
            id: req.params.id,
            action: req.params.key,
            resource: name,
            doc: doc
          };
          return _this.actions.handleAction(params, req, res);
        }));
      })
      .then(function(result){
        if (!res.headersSent){
          var body = {};
          body[collection] = _.isArray(result) ? result : [result];
          sendResponse(req, res, 200, body);
        }
      }, function(err){
        sendError(req, res, 500, err);
      });
  }

  function callGenericAction(req, res) {

    var action = _this.actions.getAction(name, req.params.action, req.method);
    if (!action) return sendError(req, res, 404);
    if (action.method && action.method !== req.method) return sendError(req, res, 405);
    
    var params = {
      id: req.params.id,
      action: req.params.action,
      resource: name
    };
    _this.actions.handleAction(params, req, res, _this.adapter)
      .then(function(result) {
        if (!res.headersSent) {
          var body = {};
          body[collection] = _.isArray(result) ? result : [result];
          sendResponse(req, res, 200, body);
        }
      }, function(err) {
        sendError(req, res, 500, err);
      });
  }

  function schemaAssociations(schema) {
    var associations = [];
    _.each(schema, function(value, key) {
      var type = _.isArray(value) ? value[0] : value;
      type = _.isPlainObject(type) ? type.ref : type;
      if(typeof type === 'string') {
        type = inflect.pluralize(type);
        associations.push({key: key, type: type});
      }
    });
    return associations;
  }

  function addLinksToBody(body, schema, prefix) {
    var baseUrl = this.options.baseUrl
    , namespace = this.options.namespace
    , associations = schemaAssociations(schema);
    if(!associations.length) return;

    body.links = body.links || {};
    associations.forEach(function(association) {
      var name = [prefix, association.key].join('.');
      body.links[name] = {
        type: association.type
      };
      if (baseUrl) {
        body.links[name].href = baseUrl + '/' + (!!namespace ? namespace + '/' : '') +
          association.type + '/{' + name + '}';
      }
    });
  }

  function linkedIds(resources, path, schema) {
    var ids = [];
    _.each(resources, function(resource) {
      if (_.isArray(schema[path]) || _.isObject(schema[path])) {
        var isExt = (_.isArray(schema[path]) ? schema[path][0] : schema[path]).external;

        if (resource.links && resource.links[path] && !isExt) {
          var id = resource.links[path];
          if (_.isArray(id)) {
            ids = ids.concat(_.map(id, function(d){return d.toString()}));
          } else {
            ids.push(id.toString());
          }
        }
      }
    });

    return ids;
  }

  function getTypeOfRef(schema, key){
    var type = _.isArray(schema[key]) ? schema[key][0] : schema[key];
    return _.isPlainObject(type) ? type.ref : type;
  }


  function getLinked(ids, type, req, res) {
    var deferred = RSVP.defer();

    if (ids.length > 0) {
      var collection = inflect.pluralize(type);
      director.methods.get(collection, _.extend({},req,{
        params: {id: ids.join(',')},
        query: {
          fields: req.query.fields,
          includeDeleted: req.query.includeDeleted || false
        },
        /* the line below fixes mocha "Fortune test runner Fortune compound document support
         * should return grandchild plus child documents of people when requested"
         *
         * however, this may be an indicator of a broader design issue where it's hard for the
         * library code to distinguish between the native and custom request properties which
         * may cause inconsistent behaviour
         *
         * suggested solution: nesting custom properties, e.g. req.custom.linker = linker
         */
        linker: undefined
      })).then(function(response){
        deferred.resolve({
          type: collection,
          resources: response.body[collection]
        });
      });
    }else{
      deferred.resolve(type ? {type: inflect.pluralize(type)} : undefined);
    }
    return deferred.promise;
  }

  function buildPathsTree(inclusions){
    var includePaths = {};

    _.each(inclusions, function(include) {
      include = include.split('.');
      var location = includePaths;
      _.each(include, function(part) {
        if (!location[part]) {
          location[part] = {__includeInBody: false};
        }
        location = location[part];
      });
      location.__includeInBody = true;
    });
    return includePaths;
  }

  /**
   * Refactoring options:
   * 1. Make it yield parts of `body` rather than operate on it directly
   */
  function appendLinked(linkpath, body, resources, schema, inclusions, req, res) {
    // build of tree of paths to fetch and maybe include
    var includePaths = buildPathsTree(inclusions);
    var _this = this;

    var fetchedIds = {};
    body.linked = {};

    return fetchChildren(linkpath, includePaths, resources, schema).then(function() {
      return body;
    });

    function fetchChildren(linkpath, config, resources, schema) {
      return RSVP.all(_.map(_.keys(config), function(key) {
        if(key === "__includeInBody") return null;

        var type = getTypeOfRef(schema, key),
            ids = _.difference(linkedIds(resources, key, schema), fetchedIds[type]);

        //only wanna cache ids for resources that are going to be present in the body
        if(config[key].__includeInBody){
          fetchedIds[type] = _.union(fetchedIds[type] || [], ids);
        }

        return getLinked.call(_this, ids, type, req, res).then(function(result) {
          var relation = _.isArray(schema[key]) ? schema[key][0] : schema[key];

          if(relation && relation.external){
            var pluralisedRef = inflect.pluralize(relation.ref || key);
            body.linked[pluralisedRef] = "external";
            body.links[linkpath + "." + key] = {type: pluralisedRef};
          }

          if (result && result.resources) {
            if (config[key].__includeInBody) {
              body.linked[result.type] = body.linked[result.type] || [];
              body.linked[result.type] = body.linked[result.type].concat(result.resources);
              body.links[linkpath + "." + key] = {type: result.type};
            }
            return fetchChildren(linkpath + "." + key, config[key],
                                 result.resources,
                                 _this._schema[inflect.singularize(result.type)]);
          }else if (result && result.type){
            if (config[key].__includeInBody){
              body.linked[result.type] = body.linked[result.type] || [];
              body.links[linkpath + '.' + key] = {type: result.type}
            }
          }
        });

      }));
    }
  }

  /*
   * Append a top level "links" object for URL-style JSON API.
   *
   * @api private
   * @param {Object} body deserialized response body
   * @return {Object}
   */
  function appendLinks(body, req, res) {
    var schemas = this._schema,
        _this = this;
    var promises = [];

    _.each(body, function(value, key) {
      if(key === 'meta') return;
      var modelName = inflect.singularize(key)
      , schema = schemas[modelName];

      if (schema) {
        addLinksToBody.call(_this, body, schema, key);
        if (req.query.include) {
          var includes = _.isUndefined(req.scopedIncludes) ? req.query.include : req.scopedIncludes;
          promises.push(appendLinked.call(_this,
                                          inflect.pluralize(modelName),
                                          body,
                                          body[key],
                                          schema,
                                          includes.split(','),
                                          req,
                                          res));
        }
      }
    });

    return RSVP.all(promises).then(function() {
      return body;
    });
  }

  function getAssociations (schema) {
    var associations = [];
    var options = this.options;

    _.each(schema, function (value, key) {
      var singular = !_.isArray(value);
      var type = !singular ? value[0] : value;
      var external = false;

      if (_.isPlainObject(type)){
        external = !!type.external;
        type = type.ref;
      }

      if (typeof type === 'string') {
        type = options.inflect ? inflect.pluralize(type) : type;
        associations.push({
          key: key, //Field key in (foreign) resource
          type: type, //Resource name that is referenced by foreign resource
          singular: singular, //Association type (...to-one/...to-many)
          external: external
        });
      }
    });
    return associations;
  }

  function parseSelectProjection(fields, modelName){
    try{
      if (_.isObject(fields)){
        return fields[modelName].split(',');
      }else if(_.isString(fields)){
        return fields.split(',');
      }else{
        return null;
      }
    }catch(e){
      return null;
    }
  }
}



/*
 * Expose the route method.
 */
module.exports = route;
