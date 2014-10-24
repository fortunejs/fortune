var RSVP = require('rsvp');
var _ = require('lodash');
var inflect = require('i')();

var Promise = RSVP.Promise;

// constants
var MIME = {
  standard: ['application/vnd.api+json', 'application/json'],
  patch: ['application/json-patch+json']
};
var errorMessages = {
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
 */
function route(name, model) {
  var _this = this;
  var router = this.router;
  var adapter = this.adapter;

  // options
  var options = this.options;

  // routes
  var collection = options.inflect ? inflect.pluralize(name) : name;
  var collectionRoute = [options.namespace, collection].join('/') + options.suffix;
  var individualRoute = [options.namespace, collection].join('/') + '/:id' + options.suffix;
  var individualRouteResource = individualRoute + '/:key' + options.suffix;
  this.fnHandlers = {};
  var fnHandlers = this.fnHandlers;
  fnHandlers[collectionRoute] = {};
  fnHandlers[individualRoute] = {};
  fnHandlers[individualRouteResource] = {};

  // response emitters
  var sendError = function (req, res, status, error) {
    if (!!error) console.trace(error);
    var object = {
      error: errorMessages[status],
      detail: error ? error.toString() : ''
    };
    var str = options.environment === 'production' ?
      JSON.stringify(object, null, null) :
      JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[1]);
    res.send(status, str);
  };
  var sendResponse = function (req, res, status, object) {
    if (status === 204) return res.send(status);

    object = object || {};
    object = appendLinks.call(_this, object);

    var finishSending = function(object){
      var str = options.environment === 'production' ?
          JSON.stringify(object, null, null) :
          JSON.stringify(object, null, 2) + '\n';

      // web browser check
      res.set('Content-Type', (req.get('User-Agent') || '').indexOf('Mozilla') === 0 ?
          MIME.standard[0] : MIME.standard[1]);

      res.send(status, str);
    };

    if(req.query["include"]) {
      var includes = req.query["include"].split(',');
      appendLinked.call(_this, object, includes).then(finishSending);
    }else{
      finishSending(object);
    }
  };

  var methodNotAllowed = function (req, res) {
    sendError(req, res, 405);
  };

  /*!
   * Do before transformation.
   *
   * @param {String} [model]
   * @param {Object} resource
   * @param {Object} request
   * @param {Object} response
   */
  var beforeTransform = function (model, resource, request, response) {
    if (arguments.length < 4) {
      response = request;
      request = resource;
      resource = model;
      model = name;
    }
    return new Promise(function (resolve, reject) {
      if (!_this._before.hasOwnProperty(model)) return resolve(resource);
      var transform = _this._before[model].call(resource, request, response);
      if (!transform) return reject();
      resolve(transform);
    });
  };

  /*!
   * Do after transformation.
   *
   * @param {String} [model]
   * @param {Object} resource
   * @param {Object} request
   * @param {Object} response
   */
  var afterTransform = function (model, resource, request, response) {
    if (arguments.length < 4) {
      response = request;
      request = resource;
      resource = model;
      model = name;
    }
    return new Promise(function (resolve, reject) {
      if (!_this._after.hasOwnProperty(model)) return resolve(resource);
      var transform = _this._after[model].call(resource, request, response);
      if (!transform) return reject();
      resolve(transform);
    });
  };

  var mimeCheck = function (contentType) {
    return ~MIME.standard.indexOf(contentType.split(';').shift());
  };

  /*!
   * Handle creating a resource.
   */
  fnHandlers[collectionRoute]["post"] = function (req, res) {
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
    .then(function (linkedResources) {
      if (!primaryResources.length) {
        return sendResponse(req, res, 204);
      }

      var body = {};
      var location = options.baseUrl + '/';
      location += !!options.namespace ? options.namespace + '/' : '';
      location += collection + '/' + primaryResources.map(function (resource) {
        return resource.id;
      }).join(',');
      res.set('Location', location);

      if (Object.keys(linkedResources).length) {
        var promises = [];

        body.linked = linkedResources;
        primaryResources.forEach(function (resource) {
          promises.push(adapter.find(name, resource.id));
        });

        RSVP.all(promises).then(function (resources) {
          return RSVP.all(resources.map(function (resource) {
            return afterTransform(resource, req, res);
          }));
        }).then(function (resources) {
          body[collection] = resources;
          sendResponse(req, res, 201, body);
        });
      } else {
        body[collection] = primaryResources;
        sendResponse(req, res, 201, body);
      }
    }, function (error) {
      sendError(req, res, 500, error);
    });

    /**
     * Internal function to create resources.
     *
     * @api private
     * @param {String|Object} model
     * @param {Array} resources
     */
    function createResources (model, resources) {
      var before = [];
      try {
        resources.forEach(function (resource) {
          before.push(beforeTransform(resource, req, res));
        });
      } catch(error) {
        return sendError(req, res, 400, error);
      }

      // do before transforms
      return RSVP.all(before)

      // create the resources
      .then(function (resources) {
        return RSVP.all(resources.map(function (resource) {
          return adapter.create(model, resource);
        }));
      }, function (errors) {
        sendError(req, res, 400, errors);
      })

      // do after transforms
      .then(function (resources) {
        return RSVP.all(resources.map(function (resource) {
          return afterTransform(resource, req, res);
        }));
      }, function (error) {
        sendError(req, res, 500, error);
      });
    }
  };

  /*
   * Get a list of resources.
   */
  fnHandlers[collectionRoute]["get"] = function (req, res) {
    var ids = [];

    if (typeof req.query.ids === 'string') ids = req.query.ids.split(',');
    if (typeof req.query.ids === 'object') ids = req.query.ids;

    var query = _.clone(req.query);
    query.ids && (query.id=ids) && (delete query.ids);

    var limit = query.limit;
    var offset = query.offset;

    var sortParams = req.query["sort"];
    var sort;

    if(sortParams){
      sort= {};
      sortParams = sortParams.split(',');
      _.each(sortParams,function(value,key,sortParams){
        var sortDirection = (value[0]=="-"?-1:1);
        sortDirection==-1 && (value = value.substr(1));
        sort[value]=sortDirection;
      });
    }

    var fields = query.fields;
    fields && (fields = fields.replace(/,/g," "));

    //JSON api makes these special namespaces, so we ignore them in our query.
    delete query.include;
    delete query.fields;
    delete query.sort;
    delete query.limit;
    delete query.offset;

    //keep ability to reference linked objs via links.*
    _.each(query,function(value, key){
      if(key.substring(0,6) == "links."){
        query[key.substr(6)]=query[key];
        delete query[key];
      }
    },this);
    //TODO: links.->"" is a mongodb storage issue, and should be in the mongodb adapter rather than here.

    adapter.findMany(model, query, limit, offset, sort, fields)

    // do after transforms
    .then(function (resources) {
      return RSVP.all(resources.map(function (resource) {
        return afterTransform(resource, req, res);
      }));
    }, function (error) {
      sendError(req, res, 500, error);
    })

    // send the response
    .then(function (resources) {
      var body = {};

      body[collection] = resources;
      sendResponse(req, res, 200, body);
    }, function (error) {
      sendError(req, res, 500, error);
    });

  };

  router.post(collectionRoute,fnHandlers[collectionRoute]["post"]);
  router.get(collectionRoute,fnHandlers[collectionRoute]["get"]);
  /*
   * Handle unsupported methods on a collection of resources.
   */
  router.put(collectionRoute, methodNotAllowed);
  router.patch(collectionRoute, methodNotAllowed);
  router.delete(collectionRoute, methodNotAllowed);

  /*
   * Get an individual resource, or many.
   */
  fnHandlers[individualRoute]["get"] = function (req, res) {
    var ids = req.params.id.split(',');

    // get resources by IDs
    adapter.findMany(model, ids)

    // do after transforms
    .then(function (resources) {
      if (resources.length) {
        return RSVP.all(resources.map(function (resource) {
          return afterTransform(resource, req, res);
        }));
      } else {
        sendError(req, res, 404);
      }
    }, function (error) {
      sendError(req, res, 500, error);
    })

    // send the response
    .then(function (resources) {
      var body = {};

      body[collection] = resources;
      sendResponse(req, res, 200, body);
    }, function (error) {
      sendError(req, res, 500, error);
    });
  };
  /*
   * Get the related resources of an individual resource.
   */
  fnHandlers[individualRouteResource]["get"]= function (req, res) {
    var id = req.params.id;
    var key = req.params.key;

    // get a resource by ID
    adapter.find(model, id)

    // do after transform
    .then(function (resource) {
      return afterTransform(resource, req, res);
    }, function (error) {
      sendError(req, res, 404, error);
    })

    // change context to resource
    .then(function (resource) {
      var ids;
      var relatedModel;

      try {
        ids = resource.links[key];
        ids = _.isArray(ids) ? ids : [ids];
        relatedModel = _this._schema[name][key];
        relatedModel = _.isArray(relatedModel) ? relatedModel[0] : relatedModel;
        relatedModel = _.isPlainObject(relatedModel) ? relatedModel.ref : relatedModel;
      } catch(error) {
        return sendError(req, res, 404, error);
      }

      // find related resources
      adapter.findMany(relatedModel, ids)

      // do after transforms
      .then(function (resources) {
        return RSVP.all(resources.map(function (resource) {
          return afterTransform(relatedModel, resource, req, res);
        }));
      }, function (error) {
        sendError(req, res, 500, error);
      })

      // send the response
      .then(function (resources) {
        var body = {};
        var relatedKey = options.inflect ? inflect.pluralize(relatedModel) : relatedModel;

        body[relatedKey] = resources;
        sendResponse(req, res, 200, body);
      }, function (error) {
        sendError(req, res, 500, error);
      });

    }, function (error) {
      sendError(req, res, 500, error);
    });
  };

  /*
   * Put a resource.
   */
  fnHandlers[individualRoute]["put"]= function (req, res) {
    var id = req.params.id;
    var update;

    // header error handling
    if (!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    try {
      update = req.body[collection][0];
      if (!update) return sendError(req, res, 400);
    } catch(error) {
      return sendError(req, res, 400, error);
    }

    // try to find the resource by ID
    adapter.find(model, id)

    // resource found, let's update it
    .then(function () {

      // do before transform
      beforeTransform(update, req, res)

      // update the resource
      .then(function (update) {
        return adapter.update(model, id, update);
      }, function (error) {
        sendError(req, res, 500, error);
      })

      // do after transform
      .then(function (update) {
        return afterTransform(update, req, res);
      }, function (error) {
        sendError(req, res, 500, error);
      })

      // send the response
      .then(function (update) {
        var body = {};

        body[collection] = [update];
        sendResponse(req, res, 200, body);
      }, function (error) {
        sendError(req, res, 500, error);
      });

    },

    // resource not found, try to create it
    function () {

      // do before transform
      beforeTransform(update, req, res)

      // create the resource
      .then(function (resource) {
        return adapter.create(model, id, resource);
      }, function (error) {
        sendError(req, res, 400, error);
      })

      // do after transform
      .then(function (resource) {
        return afterTransform(resource, req, res);
      }, function (error) {
        sendError(req, res, 500, error);
      })

      // send the response
      .then(function (resource) {
        var body = {};

        body[collection] = [resource];
        sendResponse(req, res, 201, body);
      }, function (error) {
        sendError(req, res, 500, error);
      });

    });
  };

  /*
   * Delete a resource.
   */
  fnHandlers[individualRoute]["delete"]= function (req, res) {
    var id = req.params.id;

    // find the resource by ID
    adapter.find(model, id)

    // do before transform
    .then(function (resource) {
      return beforeTransform(resource, req, res);
    }, function (error) {
      sendError(req, res, 404, error);
    })

    // let's delete it
    .then(function () {
      adapter.delete(model, id).then(function () {
        sendResponse(req, res, 204);
      }, function (error) {
        sendError(req, res, 500, error);
      });
    },

    // resource not found
    function (error) {
      sendError(req, res, 404, error);
    });
  };

  /*
   * Patch a resource.
   */
  fnHandlers[individualRoute]["patch"]= function (req, res) {
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
        var field = operation.path.split('/').slice(3);
        var value = operation.value;
        var path = update;

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
    beforeTransform(update, req, res)

    // update the resource
    .then(function (update) {
      return adapter.update(model, id, update);
    }, function (error) {
      sendError(req, res, 403, error);
    })

    // do after transform
    .then(function (resource) {
      return afterTransform(resource, req, res);
    }, function (error) {
      sendError(req, res, 500, error);
    })

    // send the response
    .then(function (resource) {
      var body = {};

      body[collection] = [resource];
      sendResponse(req, res, 200, body);
    }, function (error) {
      sendError(req, res, 500, error);
    });
  };

  router.get(individualRoute,fnHandlers[individualRoute]["get"]);
  router.get(individualRouteResource,fnHandlers[individualRouteResource]["get"]);
  router.put(individualRoute,fnHandlers[individualRoute]["put"]);
  router.delete(individualRoute,fnHandlers[individualRoute]["delete"]);
  router.patch(individualRoute,fnHandlers[individualRoute]["patch"]);
  /*
   * POSTing a resource to a predetermined ID is not allowed,
   * since that is what PUT is for.
   */
  router.post(individualRoute, methodNotAllowed);

  //BEGIN SS Addition:
  /*
  * Append a top level "linked" object for hypermedia.
  *
  * @api private
  * @param {Object} body deserialized response body
  * @return {Object}
  */
  function appendLinked (body,includes) {
      var _this = this;
      var options = this.options;
      var promises =[];
      var alreadyLinked = {};

      _.each(body, function (value, key) {
          if (key === 'meta') return;

          var schema = _this._schema[options.inflect ? inflect.singularize(key) : key];
          var associations = getAssociations.call(_this, schema);

          if (!associations.length) return;

          var includedAssociations = _.filter(associations,function(association){
              return _.contains(includes,association.key);
          });

          promises.push(_.map(includedAssociations,function(association) {
              return _.map(value, function(obj){
                  var linkedAssociationIds = obj.links[association.key];

                  if(linkedAssociationIds == undefined ) { return []};

                  linkedAssociationIds=[].concat(linkedAssociationIds);
                  linkedAssociationIds = _.filter(linkedAssociationIds,function(linkedAssociationId){
                      var alreadyProcessed = alreadyLinked[linkedAssociationId.id]?true:false;
                      alreadyLinked[linkedAssociationId.id]=true;
                      return !alreadyProcessed;
                  });
                  if(!linkedAssociationIds.length) { return []};

                  var resourceName = options.inflect ? inflect.singularize(association.type) : association.type;

                  //Little hack: seemed to be the only way to solve inconsistent tense issues
                  resourceName = _this._schema[resourceName]?resourceName:association.type;

                  return _this.adapter.findMany(resourceName, linkedAssociationIds).then(function(resources){
                      resources=[].concat(resources);
                      resources.length && (body.linked = body.linked || {});

                      _.each(resources,function(resource){
                          resource.links && delete resource.links;
                          body.linked[association.type] = body.linked[association.type] || [];
                          body.linked[association.type].push(resource);
                      });
                  }).catch(function (error) {
                      console.log("err: ",error);
                      //todo:add better error handling
                  });
              });
          }));
      });

      var flatPromises = _.flatten(promises);
      return RSVP.all(flatPromises).then(function (results) {
          return body;
      }).catch(function (error) {
          console.log("err: ",error);
      });
  }
  this.appendLinked=appendLinked;

  /*
   * Append a top level "links" object for hypermedia.
   *
   * @api private
   * @param {Object} body deserialized response body
   * @return {Object}
   */
  function appendLinks (body) {
    var _this = this;
    var options = this.options;

    _.each(body, function (value, key) {
      if (key === 'meta') return;
      var schema = _this._schema[options.inflect ? inflect.singularize(key) : key];
      var associations = getAssociations.call(_this, schema);

      if (!associations.length) return;
      body.links = body.links || {};
      associations.forEach(function (association) {
        var name = [key, association.key].join('.');

        body.links[name] = {
          href: options.baseUrl + '/' +
            (!!options.namespace ? options.namespace + '/' : '') +
            association.type + '/{' + name + '}',
          type: association.type
        };
      });
    });
    return body;
  }
  this.appendLinks=appendLinks;
  return this;
}
/*
 * Get associations from a schema.
 *
 * @api private
 * @param {Object} schema
 * @return {Array}
 */
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


/*
 * Expose the route method.
 */
module.exports = route;
