var inflect = require('i')()
  , RSVP = require('rsvp')
  , _ = require('lodash');

/**
 * Setup routes for a resource, given a name and model.
 *
 * @param {String} name
 * @param {Object} model
 */
function route(name, model) {
  var _this = this
    , express = this.express
    , adapter = this.adapter

    // options
    , baseUrl = this.options.baseUrl
    , namespace = this.options.namespace
    , production = this.options.production

    // routes
    , collection = inflect.pluralize(name)
    , collectionRoute = namespace + '/' + collection
    , individualRoute = namespace + '/' + collection + '/:id';

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

  // response emitters
  var sendError = function(res, status, error) {
    var object = {
      error: errorMessages[status],
      detail: error
    }, str = production ?
      JSON.stringify(object, null, null) :
      JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[1]);
    res.send(status, str);
  };
  var sendResponse = function(res, status, object) {
    if(!!baseUrl) object = appendLinks.call(_this, object);

    var str = production ?
      JSON.stringify(object, null, null) :
      JSON.stringify(object, null, 2) + '\n';

    res.set('Content-Type', MIME.standard[0]);
    res.send(status, str);
  };
  var methodNotAllowed = function(req, res) {
    sendError(res, 405);
  };

  /*!
   * Do before transformation
   *
   * @param {Object} [model]
   * @param {Object} resource
   * @param {Object} request
   */
  var beforeTransform = function(model, resource, request) {
    if(arguments.length < 3) {
      request = resource;
      resource = model;
      model = name;
    }
    return new RSVP.Promise(function(resolve, reject) {
      if(!_this._before.hasOwnProperty(model)) return resolve(resource);
      _this._before[model].call(resource, resolve, reject, request);
    });
  };

  /*!
   * Do after transformation
   *
   * @param {Object} [model]
   * @param {Object} resource
   * @param {Object} request
   */
  var afterTransform = function(model, resource, request) {
    if(arguments.length < 3) {
      request = resource;
      resource = model;
      model = name;
    }
    return new RSVP.Promise(function(resolve, reject) {
      if(!_this._after.hasOwnProperty(model)) return resolve(resource);
      _this._after[model].call(resource, resolve, reject, request);
    });
  };

  var mimeCheck = function(contentType) {
    return MIME.standard.indexOf(contentType.split(';').shift().toLowerCase()) >= 0;
  };

  /*!
   * Handle creating a resource.
   */
  express.post(collectionRoute, function(req, res) {

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(res, 412);
    }

    var before = [];
    try {
      req.body[collection].forEach(function(resource) {
        before.push(beforeTransform(resource, req));
      });
    } catch(error) {
      return sendError(res, 400, error);
    }

    // do before transforms
    RSVP.all(before)

    // create the resources
    .then(function(resources) {
      return RSVP.all(resources.map(function(resource) {
        return adapter.create(model, resource);
      }));
    }, function(error) {
      sendError(res, 403, error);
    })

    // do after transforms
    .then(function(resources) {
      return RSVP.all(resources.map(function(resource) {
        return afterTransform(resource, req);
      }));
    }, function(error) {
      sendError(res, 500, error);
    })

    // send the response
    .then(function(resources) {
      var body = {};
      body[collection] = resources;
      sendResponse(res, 201, body);
    }, function(error) {
      sendError(res, 403, error);
    });
  });

  /*
   * Get a list of resources.
   */
  express.get(collectionRoute, function(req, res) {
    var ids = [];
    if(typeof req.query.ids == 'string') ids = req.query.ids.split(',');
    if(typeof req.query.ids == 'array') ids = req.query.ids;

    // get resources by IDs
    adapter.findMany(model, ids)

    // do after transforms
    .then(function(resources) {
      return RSVP.all(resources.map(function(resource) {
        return afterTransform(resource, req);
      }));
    }, function(error) {
      sendError(res, 500, error);
    })

    // send the response
    .then(function(resources) {
      var body = {};
      body[collection] = resources;
      sendResponse(res, 200, body);
    }, function(error) {
      sendError(res, 403, error);
    });

  });

  /*
   * Handle unsupported methods on a collection of resources.
   */
  express.put(collectionRoute, methodNotAllowed);
  express.patch(collectionRoute, methodNotAllowed);
  express.delete(collectionRoute, methodNotAllowed);

  /*
   * Get an individual resource, or many.
   */
  express.get(individualRoute, function(req, res) {
    var ids = req.params.id.split(',');

    // get resources by IDs
    adapter.findMany(model, ids)

    // do after transforms
    .then(function(resources) {
      if(resources.length) {
        return RSVP.all(resources.map(function(resource) {
          return afterTransform(resource, req);
        }));
      } else {
        sendError(res, 404);
      }
    }, function(error) {
      sendError(res, 500, error);
    })

    // send the response
    .then(function(resources) {
      var body = {};
      body[collection] = resources;
      sendResponse(res, 200, body);
    }, function(error) {
      sendError(res, 500, error);
    });
  });

  /*
   * Get the related resources of an individual resource.
   */
  express.get(individualRoute + '/:key', function(req, res) {
    var id = req.params.id
      , key = req.params.key;

    // get a resource by ID
    adapter.find(model, id)

    // do after transform
    .then(function(resource) {
      return afterTransform(resource, req);
    }, function(error) {
      sendError(res, 404, error);
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
        return sendError(res, 404, error);
      }

      // find related resources
      adapter.findMany(relatedModel, ids)

      // do after transforms
      .then(function(resources) {
        return RSVP.all(resources.map(function(resource) {
          return afterTransform(relatedModel, resource, req);
        }));
      }, function(error) {
        sendError(res, 500, error);
      })

      // send the response
      .then(function(resources) {
        var body = {};
        body[inflect.pluralize(relatedModel)] = resources;
        sendResponse(res, 200, body);
      }, function(error) {
        sendError(res, 403, error);
      });

    }, function(error) {
      sendError(res, 403, error);
    });
  });

  /*
   * Put a resource.
   */
  express.put(individualRoute, function(req, res) {

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(res, 412);
    }

    var id = req.params.id
      , update;

    try {
      update = req.body[collection][0];
      if(!update) return sendError(res, 400);
    } catch(error) {
      return sendError(res, 400, error);
    }

    // try to find the resource by ID
    adapter.find(model, id)

    // resource found, let's update it
    .then(function() {

      // do before transform
      beforeTransform(update, req)

      // update the resource
      .then(function(update) {
        return adapter.update(model, id, update);
      }, function(error) {
        sendError(res, 403, error);
      })

      // do after transform
      .then(function(update) {
        return afterTransform(update, req);
      }, function(error) {
        sendError(res, 500, error);
      })

      // send the response
      .then(function(update) {
        var body = {};
        body[collection] = [update];
        sendResponse(res, 200, body);
      }, function(error) {
        sendError(res, 403, error);
      });

    },

    // resource not found, try to create it
    function() {

      // do before transform
      beforeTransform(update, req)

      // create the resource
      .then(function(resource) {
        return adapter.create(model, id, resource);
      }, function(error) {
        sendError(res, 403, error);
      })

      // do after transform
      .then(function(resource) {
        return afterTransform(resource, req);
      }, function(error) {
        sendError(res, 500, error);
      })

      // send the response
      .then(function(resource) {
        var body = {};
        body[collection] = [resource];
        sendResponse(res, 201, body);
      }, function(error) {
        sendError(res, 500, error);
      });

    });
  });

  /*
   * Delete a resource.
   */
  express.delete(individualRoute, function(req, res) {
    var id = req.params.id;

    // find the resource by ID
    adapter.find(model, id)

    // resource found, let's delete it
    .then(function() {
      adapter.delete(model, id).then(function() {
        sendResponse(res, 204);
      }, function(error) {
        sendError(res, 500, error);
      });
    },

    // resource not found
    function(error) {
      sendError(res, 404, error);
    });
  });

  /*
   * Patch a resource.
   */
  express.patch(individualRoute, function(req, res) {
    var id = req.params.id;

    // header error handling
    if(!mimeCheck(req.get('content-type'))) {
      return sendError(res, 412);
    }

    var update = {};
    try {
      // parse patch request
      req.body.forEach(function(operation) {
        var field = operation.path.split('/').pop();
        var value = operation.value;
        if(operation.op == 'replace') {
          update[field] = value;
        }
      });
    } catch(error) {
      return sendError(res, 400, error);
    }

    // do before transform
    beforeTransform(update, req)

    // update the resource
    .then(function(update) {
      return adapter.update(model, id, update);
    }, function(error) {
      sendError(res, 403, error);
    })

    // do after transform
    .then(function(resource) {
      return afterTransform(resource, req);
    }, function(error) {
      sendError(res, 500, error);
    })

    // send the response
    .then(function(resource) {
      var body = {};
      body[collection] = [resource];
      sendResponse(res, 200, body);
    }, function(error) {
      sendError(res, 500, error);
    });
  });

  /*
   * POSTing a resource to a predetermined ID is not allowed,
   * since that is what PUT is for.
   */
  express.post(individualRoute, methodNotAllowed);

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
    if(key == 'meta') return;
    var modelName = inflect.singularize(key)
      , schema = schemas[modelName]
      , associations = [];

    _.each(schema, function(value, key) {
      key = inflect.underscore(key);
      var type = _.isArray(value) ? value[0] : value;
      type = _.isPlainObject(type) ? type.ref : type;
      if(typeof type == 'string') {
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
          key + '/{' + name + '}',
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
