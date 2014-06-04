var RSVP = require('rsvp')
, _ = require('lodash');

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
 */
function route(name, model, resources, inflect) {
  var _this = this
  , router = this.router
  , adapter = this.adapter

  // options
  , baseUrl = this.options.baseUrl
  , namespace = this.options.namespace
  , suffix = this.options.suffix
  , production = this.options.production

  // routes
  , collection = inflect.pluralize(name)
  , collectionRoute = namespace + '/' + collection + suffix
  , individualRoute = namespace + '/' + collection + '/:id' + suffix;

  var options = this.options;

  // response emitters
  var sendError = function (req, res, status, error) {
    if (!!error) console.trace(error);
    var object = {
      error: errorMessages[status],
      detail: error ? error.toString() : ''
    }, str = production ?
          JSON.stringify(object, null, null) :
          JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[1]);
    res.send(status, str);
  };
  var sendResponse = function (req, res, status, object) {
    if (status === 204) return res.send(status);

    object = object || {};
    appendLinks.call(_this, object, req, res).then(function(object) {
      var str = production ?
            JSON.stringify(object, null, null) :
            JSON.stringify(object, null, 2) + '\n';

      res.set('Content-Type', !req.get('User-Agent') ? MIME.standard[0] : MIME.standard[1]);
      res.send(status, str);
    });
  };
  var methodNotAllowed = function (req, res) {
    sendError(req, res, 405);
  };

  var beforeReadHook = Hook('_before', 'read');
  var beforeWriteHook = Hook('_before', 'write');
  var afterReadHook = Hook('_after', 'read');
  var afterWriteHook = Hook('_after', 'write');

  function Hook(time, type){
    return function(model, resource, request, response){
      if (arguments.length < 4) {
        response = request;
        request = resource;
        resource = model;
        model = name;
      }
      return new RSVP.Promise(function(resolve, reject){
        //If no transforms found for this resource return without change
        var hooks = resources[model].hooks;
        if (!hooks[time][type]) return resolve(resource);
        var transform = resource;
        _.each(hooks[time][type], function(fn){
          if (transform){
            if (transform.then){
              transform = transform.then(function(data){
                return fn.call(data, request, response);
              });
            }else{
              transform = fn.call(transform, request, response);
            }
          }
        });
        if (!transform) return reject();
        resolve(transform);
      });
    }
  }


  /*!
   * Get a projection
   *
   * @param {Object} resouce
   * @param {Array} fields
   */
  var project = function(resource, fields){
    return fields.length ? _.pick(resource, _.union(fields,["id"])) : resource;
  };

  var mimeCheck = function (contentType) {
    return ~MIME.standard.indexOf(contentType.split(';').shift());
  };

  /*!
   * Handle creating a resource.
   */
  router.post(collectionRoute, function (req, res) {
    var primaryResources = [];

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    createResources(model, req.body[collection])

    // handle creation of linked resources
      .then(function (resources) {
        var promises = [];
        var types = [];

        primaryResources = resources;

        if (typeof req.body.linked === 'object') {
          _.each(req.body.linked, function (linkedResources, key) {
            var singularKey = options.inflect ? inflect.singularize(key) : key;
            types.push(key);
            linkedResources = linkedResources.map(function (resource) {
              var associations = _.filter(
                getAssociations.call(_this, _this._schema[singularKey]),
                function (association) {
                  return association.type === collection;
                });

              associations.forEach(function (association) {
                resource.links = resource.links || {};
                if (primaryResources.length === 1 && association.singular) {
                  resource.links[association.key] = primaryResources[0].id;
                }
                if (!association.singular) {
                  resource.links[association.key] = primaryResources.map(function (resource) {
                    return resource.id;
                  });
                }

              });
              return resource;
            });

            promises.push(createResources(singularKey, linkedResources));
          });
        }

        return RSVP.all(promises).then(function (linkedArray) {
          var linked = {};
          linkedArray.forEach(function (resources, index) {
            linked[types[index]] = resources.map(function (resource) {
              delete resource.links;
              return resource;
            });
          });
          return linked;
        });
      }, function (error) {
        sendError(req, res, 500, error);
      })

    // send the response
      .then(function(linkedResources) { 
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

        if (Object.keys(linkedResources).length) { 
          var promises = [];

          body.linked = linkedResources;
          primaryResources.forEach(function (resource) {
            promises.push(adapter.find(name, resource.id.toString()));
          });

          RSVP.all(promises).then(function (resources) { 
            return RSVP.all(resources.map(function (resource) {
              return afterReadHook(resource, req, res);
            }));
          }).then(function (resources) {
            body[collection] = resources;
            sendResponse(req, res, 201, body);
          });
        } else {
          body[collection] = primaryResources;
          sendResponse(req, res, 201, body);
        }
      }, function(error) {
        sendError(req, res, 403, error);
      });

    function createResources(model, resources){
      var modelName = model.modelName || model;
      var before = [];
      try {
        resources.forEach(function(resource) { 
          before.push(beforeWriteHook(modelName, resource, req, res));
        });
      } catch(error) {
        return sendError(req, res, 400, error);
      }

      // do before transforms
      return RSVP.all(before)

      // create the resources
        .then(function(resources) { 
          return RSVP.all(resources.map(function(resource) {
            return adapter.create(model, resource);
          }));
        }, function(errors) {
          sendError(req, res, 403, errors);
        })
      // do after transforms
        .then(function(resources) {
          return RSVP.all(resources.map(function(resource) {
            return afterWriteHook(modelName, resource, req, res);
          }));
        }, function(error) {
          sendError(req, res, 500, error);
        });
    }
  });

  /*
   * Get a list of resources.
   */
  router.get(collectionRoute, function(req, res) {
    var match = {};
    var ids = [];
    var fields = req.query.fields ? req.query.fields.split(",") : [];

    if(req.query.ids) match.id = {$in: req.query.ids.split(',')};

    //run beforeRead
    beforeReadHook({}, req, res)
      .then(function(){
        // get resources by IDs
        return adapter.findMany(model, _.extend(match,req.query.filter));
      }, function(err){
        sendError(req, res, 500, err);
      })

    // run after read
      .then(function(resources) {
        return RSVP.all(resources.map(function(resource) {
          resource = project(resource, fields);
          return afterReadHook(resource, req, res);
        }));
      }, function(error) {
        sendError(req, res, 500, error);
      })

    // send the response
      .then(function(resources) {
        var body = {};
        body[collection] = resources;
        sendResponse(req, res, 200, body);
      }, function(error) {
        sendError(req, res, 403, error);
      });
  });

  /*
   * Handle unsupported methods on a collection of resources.
   */
  router.put(collectionRoute, methodNotAllowed);
  router.patch(collectionRoute, methodNotAllowed);

  /*
   * Get an individual resource, or many.
   */
  router.get(individualRoute, function(req, res) {
    var match = {};
    var ids = req.params.id.split(',');
    var fields = req.query.fields ? req.query.fields.split(",") : [];

    if(ids) match.id = {$in: ids};

    //run before read
    beforeReadHook({}, req, res)
      .then(function(){
        // get resources by IDs
        return adapter.findMany(model, match);
      }, function(err){
        sendError(req, res, 500, err);
      })

    // run after read hook
      .then(function(resources) {
        if(resources.length) {
          return RSVP.all(resources.map(function(resource) {
            resource = project(resource,fields);
            return afterReadHook(resource, req, res);
          }));
        } else {
          sendError(req, res, 404);
        }
      }, function(error) {
        sendError(req, res, 500, error);
      })

    // send the response
      .then(function(resources) {
        var body = {};
        body[collection] = resources;
        sendResponse(req, res, 200, body);
      }, function(error) {
        sendError(req, res, 500, error);
      });
  });

  /*
   * Get the related resources of an individual resource.
   */
  router.get(individualRoute + '/:key' + suffix, function(req, res) {
    var id = req.params.id,
        key = req.params.key,
        fields = req.query.fields ? req.query.fields.split(",") : [],
        match = {};

    if(id) match.id = id;

    beforeReadHook({}, req, res)
      .then(function(){
        // get a resource by ID
        return adapter.find(model, match);
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
          //run before read hook
          findPromise = beforeReadHook(relatedModel, {}, req, res)
            .then(function(){
              // find related resources
              return adapter.findMany(relatedModel, ids);
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
            project(resource, fields);
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
  });

  /*
   * Put a resource.
   */
  router.put(individualRoute, function (req, res) {
    var id = req.params.id;
    var update;

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    var id = req.params.id
    , update;

    try {
      update = req.body[collection][0];
      if (!update) return sendError(req, res, 400);
    } catch(error) {
      return sendError(req, res, 400, error);
    }

    // try to find the resource by ID
    adapter.find(model, id)

    // resource found, let's update it
      .then(function() {

        // do before write hook
        beforeWriteHook(update, req, res)

        // update the resource
          .then(function(update) {
            return adapter.update(model, id, update);
          }, function(error) {
            sendError(req, res, 403, error);
          })

        // do after transform
          .then(function(update) {
            return afterWriteHook(update, req, res);
          }, function(error) {
            sendError(req, res, 500, error);
          })

        // send the response
          .then(function(update) {
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
              beforeWriteHook(update, req, res)

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
  });


  /*
   * Delete a collection
   */

  router.delete(collectionRoute, function(req,res){
    adapter.findMany(model)

    .then(function(resources){
      return RSVP.all(_.map(resources,function(resource){
        return beforeWriteHook(resource, req, res);
      }));
    }, function(err){
      sendError(req,res, 404, err);
    })
    .then(function(){
      return adapter.delete(model);
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
  });

  /*
   * Delete a resource.
   */
  router.delete(individualRoute, function (req, res) {
    var id = req.params.id;

    // find the resource by ID
    adapter.find(model, id)

    // do before transform
      .then(function(resource) {
        return beforeWriteHook(resource, req, res);
      }, function(error) {
        sendError(req, res, 404, error);
      })

    // let's delete it
      .then(function() {
        return adapter.delete(model, id)
      },function(error) { // resource not found
        sendError(req, res, 404, error);
      })

      .then(function(resource){
        return afterWriteHook(resource, req, res);
      }, function(err){
        sendError(req, res, 500, err);
      })

      .then(function() {
        sendResponse(req, res, 204);
      }, function(error) {
        sendError(req, res, 500, error);
      });
  });

  /*
   * Patch a resource.
   */
  router.patch(individualRoute, function (req, res) {
    var id = req.params.id;
    var update = {};

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    try {
      // parse patch request, only 'replace' op is supported per the json-api spec
      req.body.forEach(function (operation) {
        // TODO: bulk PATCH request
        var field = operation.path.split('/').slice(3)
        , value = operation.value
        , path = update;

        if (operation.op === 'replace') {
          field.forEach(function (key, index) {
            if (index + 1 === field.length) {
              path[key] = value;
            } else {
              path[key] = path[key] || {};
              path = path[key];
            }
          });
        }
      });
    } catch(error) {
      return sendError(req, res, 400, error);
    }

    // do before transform
    beforeWriteHook(update, req, res)

    // update the resource
      .then(function(update) {
        return adapter.update(model, id, update);
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
        sendResponse(req, res, 200, body);
      }, function(error) {
        sendError(req, res, 500, error);
      });
  });

  /*
   * POSTing a resource to a predetermined ID is not allowed,
   * since that is what PUT is for.
   */
  router.post(individualRoute, methodNotAllowed);


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
            ids = ids.concat(id);
          } else {
            ids.push(id);
          }
        }
      }
    });

    return ids;
  }

  function findResources(type, ids) {
    var adapter = this.adapter,
        model = adapter.model(inflect.singularize(type));
    return adapter.findMany(model, ids);
  }

  function getLinked(fetchedIds, resources, schema, key, req, res) {
    var ids = linkedIds(resources, key, schema);
    if (ids.length > 0) {
      var _this = this;
      var type = _.isArray(schema[key]) ? schema[key][0] : schema[key];
      type = _.isPlainObject(type) ? type.ref : type;

      fetchedIds[type] = fetchedIds[type] || [];
      ids = _.without(ids, fetchedIds[type]);
      fetchedIds[type] = fetchedIds[type].concat(ids);

      return beforeReadHook(inflect.singularize(type), {}, req, res)

        .then(function(){
          return findResources.call(_this,type,ids)
        }, function(err){
          sendError(req, res, 500, err);
        })

        .then(function(resources) {
          return RSVP.all(resources.map(function(resource) {
            return afterReadHook(inflect.singularize(type), resource, req, res);
          }))
          .then(function() {
            return {type: inflect.pluralize(type), resources: resources};
          });
        });
    }

    var deferred = RSVP.defer();
    deferred.resolve();
    return deferred.promise;
  }

  function appendLinked(linkpath, body, resources, schema, inclusions, req, res) {
    // build of tree of paths to fetch and maybe include
    var includePaths = {},
        _this = this;
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
    var fetchedIds = {};
    body.linked = {};

    function fetchChildren(linkpath, config, resources, schema, req, res) {
      return RSVP.all(_.map(_.keys(config), function(key) {
        if (key !== "__includeInBody") {
          return getLinked.call(_this,fetchedIds, resources, schema, key, req, res)
            .then(function(result) {
              var relation = _.isArray(schema[key]) ? schema[key][0] : schema[key];

              if(relation && relation.external){
                var pluralisedRef = inflect.pluralize(relation.ref || key);
                body.linked[pluralisedRef] = "external";
                body.links[linkpath + "." + key] = {type: pluralisedRef};
              }

              if (result) {
                if (config[key].__includeInBody) {
                  body.linked[result.type] = body.linked[result.type] || [];
                  body.linked[result.type] = body.linked[result.type].concat(result.resources);
                  body.links[linkpath + "." + key] = {type: result.type};
                }
                return fetchChildren(linkpath + "." + key, config[key], result.resources, _this._schema[inflect.singularize(result.type)], req, res);
              }
            });
        }
      }));
    }
    return fetchChildren(linkpath, includePaths, resources, schema, req, res).then(function() {
      return body;
    });
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
          promises.push(appendLinked.call(_this,inflect.pluralize(modelName), body, body[key], schema, req.query.include.split(','), req, res));
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

      type = _.isPlainObject(type) ? type.ref : type;

      if (typeof type === 'string') {
        type = options.inflect ? inflect.pluralize(type) : type;
        associations.push({ key: key, type: type, singular: singular });
      }
    });
    return associations;
  }

}



/*
 * Expose the route method.
 */
module.exports = route;
