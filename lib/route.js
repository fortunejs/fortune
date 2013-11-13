var inflect = require('i')()
  , RSVP = require('rsvp')
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
 */
function route(name, model) {
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

  // response emitters
  var sendError = function(req, res, status, error) {
    if(!!error) console.trace(error);
    var object = {
      error: errorMessages[status],
      detail: error ? error.toString() : ''
    }, str = production ?
      JSON.stringify(object, null, null) :
      JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[1]);
    res.send(status, str);
  };
  var sendResponse = function(req, res, status, object) {
    if(status === 204) return res.send(status);

    object = object || {};
    if(!!baseUrl) object = appendLinks.call(_this, object);

    var str = production ?
      JSON.stringify(object, null, null) :
      JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', !req.get('User-Agent') ? MIME.standard[0] : MIME.standard[1]);
    res.send(status, str);
  };
  var methodNotAllowed = function(req, res) {
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
  var beforeTransform = function(model, resource, request, response) {
    if(arguments.length < 4) {
      response = request;
      request = resource;
      resource = model;
      model = name;
    }
    return new RSVP.Promise(function(resolve, reject) {
      if(!_this._before.hasOwnProperty(model)) return resolve(resource);
      var transform = _this._before[model].call(resource, request, response);
      if(!transform) return reject();
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
  var afterTransform = function(model, resource, request, response) {
    if(arguments.length < 4) {
      response = request;
      request = resource;
      resource = model;
      model = name;
    }
    return new RSVP.Promise(function(resolve, reject) {
      if(!_this._after.hasOwnProperty(model)) return resolve(resource);
      var transform = _this._after[model].call(resource, request, response);
      if(!transform) return reject();
      resolve(transform);
    });
  };

  var mimeCheck = function(contentType) {
    return MIME.standard.indexOf(contentType.split(';').shift().toLowerCase()) >= 0;
  };

  /*!
   * Handle creating a resource.
   */
  router.post(collectionRoute, function(req, res) {

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    var before = [];
    try {
      req.body[collection].forEach(function(resource) {
        before.push(beforeTransform(resource, req, res));
      });
    } catch(error) {
      return sendError(req, res, 400, error);
    }

    // do before transforms
    RSVP.all(before)

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
        return afterTransform(resource, req, res);
      }));
    }, function(error) {
      sendError(req, res, 500, error);
    })

    // send the response
    .then(function(resources) {
      if(!resources.length) {
        return sendResponse(req, res, 204);
      }
      var body = {};
      body[collection] = resources;
      if(!!baseUrl) {
        var location = baseUrl + '/';
        location += !!namespace ? namespace + '/' : '';
        location += collection + '/' + resources.map(function(resource) {
          return resource.id;
        }).join(',');
        res.set('Location', location);
      }
      sendResponse(req, res, 201, body);
    }, function(error) {
      sendError(req, res, 403, error);
    });
  });

  /*
   * Get a list of resources.
   */
  router.get(collectionRoute, function(req, res) {
    var ids = [];
    if(typeof req.query.ids === 'string') ids = req.query.ids.split(',');
    if(typeof req.query.ids === 'array') ids = req.query.ids;

    // get resources by IDs
    adapter.findMany(model, ids)

    // do after transforms
    .then(function(resources) {
      return RSVP.all(resources.map(function(resource) {
        return afterTransform(resource, req, res);
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
  router.delete(collectionRoute, methodNotAllowed);

  /*
   * Get an individual resource, or many.
   */
  router.get(individualRoute, function(req, res) {
    var ids = req.params.id.split(',');

    // get resources by IDs
    adapter.findMany(model, ids)

    // do after transforms
    .then(function(resources) {
      if(resources.length) {
        return RSVP.all(resources.map(function(resource) {
          return afterTransform(resource, req, res);
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
    var id = req.params.id
      , key = req.params.key;

    // get a resource by ID
    adapter.find(model, id)

    // do after transform
    .then(function(resource) {
      return afterTransform(resource, req, res);
    }, function(error) {
      sendError(req, res, 404, error);
    })

    // change context to resource
    .then(function(resource) {
      var ids, relatedModel;
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
      .then(function(resources) {
        return RSVP.all(resources.map(function(resource) {
          return afterTransform(relatedModel, resource, req, res);
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
  router.put(individualRoute, function(req, res) {

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    var id = req.params.id
      , update;

    try {
      update = req.body[collection][0];
      if(!update) return sendError(req, res, 400);
    } catch(error) {
      return sendError(req, res, 400, error);
    }

    // try to find the resource by ID
    adapter.find(model, id)

    // resource found, let's update it
    .then(function() {

      // do before transform
      beforeTransform(update, req, res)

      // update the resource
      .then(function(update) {
        return adapter.update(model, id, update);
      }, function(error) {
        sendError(req, res, 403, error);
      })

      // do after transform
      .then(function(update) {
        return afterTransform(update, req, res);
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
      beforeTransform(update, req, res)

      // create the resource
      .then(function(resource) {
        return adapter.create(model, id, resource);
      }, function(error) {
        sendError(req, res, 403, error);
      })

      // do after transform
      .then(function(resource) {
        return afterTransform(resource, req, res);
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
   * Delete a resource.
   */
  router.delete(individualRoute, function(req, res) {
    var id = req.params.id;

    // find the resource by ID
    adapter.find(model, id)

    // do before transform
    .then(function(resource) {
      return beforeTransform(resource, req, res);
    }, function(error) {
      sendError(req, res, 404, error);
    })

    // let's delete it
    .then(function() {
      adapter.delete(model, id).then(function() {
        sendResponse(req, res, 204);
      }, function(error) {
        sendError(req, res, 500, error);
      });
    },

    // resource not found
    function(error) {
      sendError(req, res, 404, error);
    });
  });

  /*
   * Patch a resource.
   */
  router.patch(individualRoute, function(req, res) {
    var id = req.params.id;

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(req, res, 412);
    }

    var update = {};
    try {
      // parse patch request, only 'replace' op is supported per the json-api spec
      req.body.forEach(function(operation) {
        // TODO: bulk PATCH request
        var field = operation.path.split('/').slice(3)
          , value = operation.value
          , path = update;

        if(operation.op === 'replace') {
          field.forEach(function(key, index) {
            if(index + 1 === field.length) {
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
    .then(function(update) {
      return adapter.update(model, id, update);
    }, function(error) {
      sendError(req, res, 403, error);
    })

    // do after transform
    .then(function(resource) {
      return afterTransform(resource, req, res);
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

}

/*
 * Append a top level "links" object for URL-style JSON API.
 *
 * @api private
 * @param {Object} body deserialized response body
 * @return {Object}
 */
function appendLinks(body) {
  var schemas = this._schema
    , baseUrl = this.options.baseUrl
    , namespace = this.options.namespace;

  _.each(body, function(value, key) {
    if(key === 'meta') return;
    var modelName = inflect.singularize(key)
      , schema = schemas[modelName]
      , associations = [];

    _.each(schema, function(value, key) {
      var type = _.isArray(value) ? value[0] : value;
      type = _.isPlainObject(type) ? type.ref : type;
      if(typeof type === 'string') {
        type = inflect.pluralize(type);
        associations.push({key: key, type: type});
      }
    });

    if(!associations.length) return;
    body.links = body.links || {};
    associations.forEach(function(association) {
      var name = [key, association.key].join('.');
      body.links[name] = {
        href: baseUrl + '/' + (!!namespace ? namespace + '/' : '') +
          association.type + '/{' + name + '}',
        type: association.type
      };
    });
  });
  return body;
}

/*
 * Expose the route method.
 */
module.exports = route;
