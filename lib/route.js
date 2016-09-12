var Promise = require('bluebird');
var _ = require('lodash');
var inflect = require('i')();
var RouteMethod = require('./route.method.js');
var sendError = require('./send-error');
var includes = require('./includes');
// constants
var MIME = {
    standard: ['application/vnd.api+json', 'application/json'],
    patch: ['application/json-patch+json']
};

var JSONAPI_Error = require('./jsonapi-error');

var validation = require('./validation');
var Joi = require('joi');

/**
 * Setup routes for a resource, given a name and model.
 *
 * @param {Object} harvester
 * @param {String} name
 * @param {Object} model
 * @param {Object} schema
 * @param {Object} routeOptions
 */
function route(harvester, name, model, schema, routeOptions) {

    var _this = this;
    var router = harvester.router;
    var adapter = harvester.adapter;

    this.name = name;

    this._oplogEnabled = !!harvester.options.oplogConnectionString;
    // options
    var options = harvester.options;
    routeOptions = routeOptions || {};
    var resourceNamespace = routeOptions.namespace;
    var namespace = resourceNamespace ? options.namespace + '/' + resourceNamespace : options.namespace;

    // routes
    var collection = options.inflect ? inflect.pluralize(name) : name;
    var collectionRoute = [namespace, collection].join('/') + options.suffix;
    var individualRoute = [namespace, collection].join('/') + '/:id' + options.suffix;
    var individualRouteResource = individualRoute + '/:key' + options.suffix;
    this.fnHandlers = this.fnHandlers || {};
    this.fnHandlers[collectionRoute] = this.fnHandlers[collectionRoute] || {};
    this.fnHandlers[individualRoute] = this.fnHandlers[individualRoute] || {};
    this.fnHandlers[individualRouteResource] = this.fnHandlers[individualRouteResource] || {};

    //v2 route

    this.get = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'get',
        route: collectionRoute,
        permissionSuffix: 'get'
    });

    this.post = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'post',
        route: collectionRoute,
        permissionSuffix: 'post'
    });

    this.put = new RouteMethod({
        resource: _this,
        harvester: harvester,
        method : 'put',
        route : collectionRoute,
        notAllowed : true
    });

    this.delete = new RouteMethod({
        resource: _this,
        harvester: harvester,
        method : 'delete',
        route : collectionRoute,
        notAllowed : true
    });

    this.patch = new RouteMethod({
        resource: _this,
        harvester: harvester,
        method : 'patch',
        route : collectionRoute,
        notAllowed : true
    });

    this.getById = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'get',
        route: individualRoute,
        permissionSuffix: 'getById'
    });

    this.putById = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'put',
        route: individualRoute,
        permissionSuffix: 'putById'
    });

    this.deleteById = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'delete',
        route: individualRoute,
        permissionSuffix: 'deleteById'
    });

    this.patchById = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'patch',
        route: individualRoute,
        permissionSuffix: 'patchById'
    });

    this.getChangeEventsStreaming = new RouteMethod({
        resource: _this,
        harvester: harvester,
        handlers : this.fnHandlers,
        method : 'get',
        route : collectionRoute,
        sse: true,
        permissionSuffix: 'getChangeEventsStreaming'
    });

    // response emitters
    var includer = includes(adapter, harvester._schema);
    this.appendLinked = function() {
        return includer.linked.apply(includer,arguments);
    };

    var sendResponse = function (req, res, status, object) {
        if (status === 204) return res.send(status);

        object = object || {};

        var finishSending = function (object) {
            object = appendLinks.call(_this, object);

            var str = options.environment === 'production' ?
                JSON.stringify(object, null, null) :
            JSON.stringify(object, null, 2) + '\n';

            // web browser check
            res.set('Content-Type', (req.get('User-Agent') || '').indexOf('Mozilla') === 0 ?
                MIME.standard[0] : MIME.standard[1]);

            res.send(status, str);
        };

        if (req.query["include"]) {
            _this.appendLinked(object, req.query["include"].split(','))
                .then(finishSending)
                .catch(function (error) {
                    sendError(req, res, error);
                });
        } else {
            finishSending(object);
        }
    };

    var methodNotAllowed = function (req, res) {
        sendError(req, res, new JSONAPI_Error({status: 405}));
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
            if (!harvester._before.hasOwnProperty(model)) {
                return resolve(resource);
            }
            var transform = harvester._before[model].call(resource, request, response);
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
            if (!harvester._after.hasOwnProperty(model)) {
                return resolve(resource);
            }
            var transform = harvester._after[model].call(resource, request, response);
            if (!transform) return reject();
            resolve(transform);
        });
    };

    var mimeCheck = function (contentType) {
        return ~MIME.standard.indexOf(contentType.split(';').shift());
    };

    function resourceToBodyValidationDef(schema, put) {
        var idDescriptor = {id: Joi.string().guid().description('id')};

        var schemaClone = _.clone(schema);

        if (put) {
            schemaClone = _.mapValues(schema, function (val) {
                if (val.isJoi) {
                    return val.optional();
                } else {
                    return val;
                }
            });
        }

        var schemaWithId = _.merge(schemaClone, idDescriptor);

        var linksWithJoiDef = _.mapValues(schemaClone.links, function (val) {
            if (_.isArray(val)) {
                return Joi.array().items(Joi.string().guid());
            } else {
                return Joi.string().guid();
            }
        });

        var schemaWithIdAndlinks = _.set(schemaWithId, 'links', Joi.object(linksWithJoiDef));

        var schemaWithIdAndLinksWrapped = Joi.array().items(Joi.object(schemaWithIdAndlinks));
        var schemaWithPrefixIdAndLinks = _.set({}, collection, put? schemaWithIdAndLinksWrapped.length(1) : schemaWithIdAndLinksWrapped);

        return Joi.object().keys(schemaWithPrefixIdAndLinks);


    }

    var postValidation = validation({body: resourceToBodyValidationDef(schema, false)});

    /*!
     * Handle creating a resource.
     */
    this.fnHandlers[collectionRoute]["post"] = function (req, res) {
        var primaryResources = [];

        // header error handling
        // TODO : change function name to isValidContentType
        if (!mimeCheck(req.get('content-type'))) {
            return sendError(req, res, new JSONAPI_Error({status: 412}));
        }

        //will need to pass in body, query, params, headers schemas


        var details = postValidation.validate(req);
        if (!_.isEmpty(details)) throw new JSONAPI_Error({status: 400, detail: 'validation failed on incoming request',
            meta: {validationErrorDetails: details}});

        return createResources(model, req.body[collection])
            .then(function (resources) {
                var promises = [];
                var types = [];

                primaryResources = resources;
                // This block allows you to post new linked resources alongside new primary resources
                if (typeof req.body.linked === 'object') {
                    _.each(req.body.linked, function (linkedResources, key) {
                        var singularKey = options.inflect ? inflect.singularize(key) : key;
                        types.push(key);
                        linkedResources = linkedResources.map(function (resource) {
                            // find out which resources are linked to by this collection
                            var associations = _.filter(
                                getAssociations(harvester._schema[singularKey], harvester.options),
                                function (association) {
                                    return association.type === collection;
                                });
                            // Supports adding links to the primary resource on the linked resources
                            associations.forEach(function (association) {
                                resource.links = resource.links || {};
                                // If there's one primary resource in the body, then add a link to the resource defined in the linked parameter
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

                        //creates the linked resources
                        promises.push(createResources(singularKey, linkedResources));
                    });
                }

                return Promise.all(promises).then(function (linkedArray) {
                    var linked = {};
                    linkedArray.forEach(function (resources, index) {
                        linked[types[index]] = resources.map(function (resource) {
                            delete resource.links;
                            return resource;
                        });
                    });
                    return linked;
                });
            })

            // send the response
            .then(function (linkedResources) {
                if (!primaryResources.length) {
                    return sendResponse(req, res, 204);
                }

                var body = {};
                var location = options.baseUrl + '/';
                location += !!namespace ? namespace + '/' : '';
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

                    Promise.all(promises).then(function (resources) {
                        return Promise.all(resources.map(function (resource) {
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
            })
            .catch(function (error) {
                sendError(req, res, error);
            });

        /**
         * Internal function to create resources.
         * Runs before transforms for each item
         * Checks for duplicates and creates the resource
         * Runs after transforms for each item
         * @api private
         * @param {String|Object} model
         * @param {Array} resources
         */
        function createResources(model, resources) {
            var before = [];

            resources.forEach(function (resource) {
                before.push(beforeTransform(resource, req, res));
            });

            // do before transforms
            return Promise.all(before)

                // create the resources
                .then(function (resources) {
                    return Promise.all(resources.map(function (resource) {
                        return adapter.create(model, resource)
                            .then(function (resp) {
                                return resp;
                            }, function (err) {
                                //11000 is mongo's duplicate key error.
                                if (err && err.code == 11000) {
                                    throw new JSONAPI_Error({status: 409});
                                } else {
                                    throw err;
                                }
                            });
                    }));
                })
                // do after transforms
                .then(function (resources) {
                    return Promise.all(resources.map(function (resource) {
                        return afterTransform(resource, req, res);
                    }));
                })
        }
    };

    /*
     * Get a list of resources.
     */
    this.fnHandlers[collectionRoute]["get"] = function (req, res) {
        var ids = [];

        if (typeof req.query.ids === 'string') ids = req.query.ids.split(',');
        if (typeof req.query.ids === 'object') ids = req.query.ids;

        var query = _.clone(req.query);
        query.ids && (query.id = ids) && (delete query.ids);

        var limit = query.limit;
        var offset = query.offset;

        var sortParams = req.query["sort"];
        var sort;

        if (sortParams) {
            sort = {};
            sortParams = sortParams.split(',');
            _.each(sortParams, function (value, key, sortParams) {
                var sortDirection = (value[0] == "-" ? -1 : 1);
                sortDirection == -1 && (value = value.substr(1));
                sort[value] = sortDirection;
            });
        }

        var fields = query.fields;
        fields && (fields = fields.replace(/,/g, " "));

        //JSON api makes these special namespaces, so we ignore them in our query.
        delete query.include;
        delete query.fields;
        delete query.sort;
        delete query.limit;
        delete query.offset;

        //keep ability to reference linked objs via links.*
        _.each(query, function (value, key) {
            if (key.substring(0, 6) == "links.") {
                query[key.substr(6)] = query[key];
                delete query[key];
            }
        }, this);

        var operatorMap = {
            "gt=": "$gt",
            "ge=": "$gte",
            "lt=": "$lt",
            "le=": "$lte"
        };

        //Adds gt,ge,lt,le queries.
        _.each(query, function (value, key) {
            if (typeof value === 'string'){
              var operator = undefined;
              if (operator = operatorMap[value.substring(0, 3)]) {
                  query[key] = {};
                  query[key][operator] = value.substr(3);
              }
            } else if (value instanceof Array){
              // allow range queries with the above operators
              var newValue = {};
              value.forEach(function(val){
                var operator = undefined;
                if (operator = operatorMap[val.substring(0, 3)]) {
                    newValue[operator] = val.substr(3);
                }
              });
              if(Object.keys(newValue).length){
                query[key] = newValue;
              };
            }
        }, this);

        //TODO: links.->"" is a mongodb storage issue, and should be in the mongodb adapter rather than here.
        //allow multiple ids or other query params at the same time.
        _.each(query, function (val, key, list) {
            if (_.isString(val) && val.indexOf(',') != -1) {
                query[key] = {$in: val.split(',')};
            }
        });


        adapter.findMany(model, query, limit, offset, sort, fields)

            // do after transforms
            .then(function (resources) {
                return Promise.all(resources.map(function (resource) {
                    return afterTransform(resource, req, res);
                }));
            })
            // send the response
            .then(function (resources) {
                var body = {};

                body[collection] = resources;
                sendResponse(req, res, 200, body);
            })
            .catch(function (error) {
                sendError(req, res, error);
            });

    };

    this.get().register();
    this.post().register();

    this._oplogEnabled && this.getChangeEventsStreaming().register();
    /*
     * Handle unsupported methods on a collection of resources.
     */
    this.put().register();
    this.patch().register();
    this.delete().register();

    /*
     * Get an individual resource, or many.
     */
    this.fnHandlers[individualRoute]["get"] = function (req, res) {
        var ids = req.params.id.split(',');

        // get resources by IDs
        adapter.findMany(model, ids)

            // do after transforms
            .then(function (resources) {
                if (resources.length) {
                    return Promise.all(resources.map(function (resource) {
                        return afterTransform(resource, req, res);
                    }));
                } else {
                    throw new JSONAPI_Error({status: 404});
                }
            })
            // send the response
            .then(function (resources) {
                var body = {};

                body[collection] = resources;
                sendResponse(req, res, 200, body);
            })
            .catch(function (error) {
                sendError(req, res, error);
            });
    };
    /*
     * Get the related resources of an individual resource.
     */
    this.fnHandlers[individualRouteResource]["get"] = function (req, res) {
        var id = req.params.id;
        var key = req.params.key;

        // get a resource by ID
        adapter.find(model, id)

            // do after transform
            .then(function (resource) {
                return afterTransform(resource, req, res);
            })

            // change context to resource
            .then(function (resource) {
                var ids;
                var relatedModel;

                ids = resource.links[key];
                ids = _.isArray(ids) ? ids : [ids];
                relatedModel = harvester._schema[name][key];
                relatedModel = _.isArray(relatedModel) ? relatedModel[0] : relatedModel;
                relatedModel = _.isPlainObject(relatedModel) ? relatedModel.ref : relatedModel;

                // find related resources
                return adapter.findMany(relatedModel, ids)

                    // do after transforms
                    .then(function (resources) {
                        return Promise.all(resources.map(function (resource) {
                            return afterTransform(relatedModel, resource, req, res);
                        }));
                    })
                    // send the response
                    .then(function (resources) {
                        var body = {};
                        var relatedKey = options.inflect ? inflect.pluralize(relatedModel) : relatedModel;

                        body[relatedKey] = resources;
                        sendResponse(req, res, 200, body);
                    });

            })
            .catch(function (error) {
                sendError(req, res, error);
            });
    };


    var putValidation = validation({body: resourceToBodyValidationDef(schema, true)});

    /*
     * Put a resource.
     */
    this.fnHandlers[individualRoute]["put"] = function (req, res) {
        var id = req.params.id;
        var update;

        // header error handling
        if (!mimeCheck(req.get('content-type'))) {
            return sendError(req, res, new JSONAPI_Error({status: 412}));
        }

        update = req.body[collection][0];

        var details = putValidation.validate(req);
        if (!_.isEmpty(details))
            throw new JSONAPI_Error({status: 400, detail: 'validation failed on incoming request', meta: {validationErrorDetails: details}});

        return adapter.find(model, id)
            // resource found, let's update it
            .then(function () {

                // do before transform
                beforeTransform(update, req, res)

                    // update the resource
                    .then(function (update) {
                        return adapter.update(model, id, update);
                    })

                    // do after transform
                    .then(function (update) {
                        return afterTransform(update, req, res);
                    })

                    // send the response
                    .then(function (update) {
                        var body = {};

                        body[collection] = [update];
                        sendResponse(req, res, 200, body);
                    })

                    .catch(function (error) {
                        sendError(req, res, error);
                    });

            })
            // resource not found, try to create it
            .catch(
            function (error) {

                // check whether resource is missing or whether error has occurred
                if (!!error) {
                    sendError(req, res, error);
                } else {
                    // do before transform
                    beforeTransform(update, req, res)

                        // create the resource
                        .then(function (resource) {
                            return adapter.create(model, id, resource);
                        })

                        // do after transform
                        .then(function (resource) {
                            return afterTransform(resource, req, res);
                        })

                        // send the response
                        .then(function (resource) {
                            var body = {};

                            body[collection] = [resource];
                            sendResponse(req, res, 201, body);
                        })

                        .catch(function (error) {
                            sendError(req, res, error);
                        });
                }
            });
    };

    /*
     * Delete a resource.
     */
    this.fnHandlers[individualRoute]["delete"] = function (req, res) {
        var id = req.params.id;

        // find the resource by ID
        adapter.find(model, id)

            // do before transform
            .then(function (resource) {
                return beforeTransform(resource, req, res);
            })

            // let's delete it
            .then(function () {
                return adapter.delete(model, id).then(function () {
                    sendResponse(req, res, 204);
                });
            })
            .catch(function (error) {
                if (!!error) {
                    sendError(req, res, error);
                } else {
                    sendError(req, res, new JSONAPI_Error({status: 404}));
                }
            });

    };

    /*
     * Patch a resource.
     */
    this.fnHandlers[individualRoute]["patch"] = function (req, res) {
        var id = req.params.id;
        var update = {};

        // header error handling
        if (!mimeCheck(req.get('content-type'))) {
            return sendError(req, res, new JSONAPI_Error({status: 412}));
        }

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

        // do before transform
        beforeTransform(update, req, res)

            // update the resource
            .then(function (update) {
                return adapter.update(model, id, update);
            })

            // do after transform
            .then(function (resource) {
                return afterTransform(resource, req, res);
            })

            // send the response
            .then(function (resource) {
                var body = {};
                body[collection] = [resource];
                sendResponse(req, res, 200, body);
            })

            .catch(function (error) {
                sendError(req, res, error);
            });
    };

    this.getById().register();
    this.putById().register();
    this.patchById().register();
    this.deleteById().register();

    /*
     * POSTing a resource to a predetermined ID is not allowed,
     * since that is what PUT is for.
     */
    router.post(individualRoute, methodNotAllowed);

    /*
     * Append a top level "links" object for hypermedia.
     *
     * @api private
     * @param {Object} body deserialized response body
     * @return {Object}
     */

    function appendLinkForKey(body, key) {
        var schema = harvester._schema[options.inflect ? inflect.singularize(key) : key];
        var associations = getAssociations(schema, options);

        if (!associations.length) return;
        body.links = body.links || {};
        associations.forEach(function (association) {
            var name = [key, association.key].join('.');

            body.links[name] = {
                href: options.baseUrl + '/' +
                (!!namespace ? namespace + '/' : '') +
                association.type + '/{' + name + '}',
                type: association.type
            };
        });
    }

    function appendLinks(body) {
        _.each(body, function (value, key) {
            if (key === 'meta') return;
            if (key === "linked") {
                _.each(value, function (val, k) {
                    appendLinkForKey(body, k);
                });

            } else {
                appendLinkForKey(body, key);
            }
        });
        return body;
    }

    this.appendLinks = appendLinks;

    function disallow(methods) {
        _.forEach(methods, function (methodName) {
            var method = _this[methodName]();
            method.options.notAllowed = true;
            method.register();
        });
    }

    this.readOnly = function () {
        disallow(['post', 'putById', 'deleteById', 'patchById']);
    };

    this.restricted = function () {
        disallow(['post', 'putById', 'deleteById', 'patchById', 'get', 'getById']);
    };

    this.immutable = function () {
        disallow(['putById', 'deleteById', 'patchById']);
    };

    return this;
}
/*
 * Get associations from a schema.
 *
 * @api private
 * @param {Object} schema
 * @return {Array}
 */
function getAssociations(schema, options) {
    var associations = [];

    _.each(schema, function (value, key) {
        var singular = !_.isArray(value);
        var type = !singular ? value[0] : value;

        type = _.isPlainObject(type) ? type.ref : type;

        if (typeof type === 'string') {
            type = options.inflect ? inflect.pluralize(type) : type;
            associations.push({key: key, type: type, singular: singular});
        }
    });

    return associations;
}

route.getRouteMethodNames = function () {
    return ['get', 'post', 'put', 'delete', 'patch', 'getById', 'putById', 'deleteById', 'patchById', 'getChangeEventsStreaming'];
};

/*
 * Expose the route method.
 */
module.exports = route;
