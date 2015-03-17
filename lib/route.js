var RSVP = require('rsvp');
var _ = require('lodash');
var inflect = require('i')();
var Promise = RSVP.Promise;
var SSE = require('./sse');
// constants
var MIME = {
    standard: ['application/vnd.api+json', 'application/json'],
    patch: ['application/json-patch+json']
};

var JSONAPI_Error = require('./jsonapi-error');



/**
 * Setup routes for a resource, given a name and model.
 *
 * @param {String} name
 * @param {Object} model
 */
function route(name, model, routeOptions) {
    var _this = this;
    var router = this.router;
    var adapter = this.adapter;

    this._oplogEnabled = !!this.options.oplogConnectionString;
    this._oplogEnabled && SSE.init(this.router, this.adapter, this.options);
    
    // options
    var options = this.options;
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

    console.log(collectionRoute, individualRoute);

    // response emitters
    // todo handle array of errors in sendError
    var sendError = require('./send-error');

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
            var includes = req.query["include"].split(',');
            appendLinked.call(_this, object, includes)
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
    this.fnHandlers[collectionRoute]["post"] = function (req, res) {
        var primaryResources = [];

        // header error handling
        if (!mimeCheck(req.get('content-type'))) {
            return sendError(req, res, new JSONAPI_Error({status: 412}));
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
            })
            .catch(function (error) {
                sendError(req, res, error);
            });

        /**
         * Internal function to create resources.
         *
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
            return RSVP.all(before)

                // create the resources
                .then(function (resources) {
                    return RSVP.all(resources.map(function (resource) {
                        return adapter.create(model, resource)
                            .then(function(resp){
                                return resp;
                            },function(err){
                                //11000 is mongo's duplicate key error.
                                if(err && err.code==11000){
                                    throw new JSONAPI_Error({status:409});
                                }else{
                                    throw err;
                                }
                            });
                    }));
                })
                // do after transforms
                .then(function (resources) {
                    return RSVP.all(resources.map(function (resource) {
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
            var operator = undefined;
            if (operator = operatorMap[value.substring(0,3)]) {
                query[key]={};
                query[key][operator]=value.substr(3);
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
                return RSVP.all(resources.map(function (resource) {
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

    router.post(collectionRoute, this.fnHandlers[collectionRoute]["post"]);
    router.get(collectionRoute, this.fnHandlers[collectionRoute]["get"]);
    this._oplogEnabled && SSE.initRoute(collectionRoute);
    /*
     * Handle unsupported methods on a collection of resources.
     */
    router.put(collectionRoute, methodNotAllowed);
    router.patch(collectionRoute, methodNotAllowed);
    router.delete(collectionRoute, methodNotAllowed);

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
                    return RSVP.all(resources.map(function (resource) {
                        return afterTransform(resource, req, res);
                    }));
                } else {
                    sendError(req, res, new JSONAPI_Error({status: 404}));
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
                relatedModel = _this._schema[name][key];
                relatedModel = _.isArray(relatedModel) ? relatedModel[0] : relatedModel;
                relatedModel = _.isPlainObject(relatedModel) ? relatedModel.ref : relatedModel;

                // find related resources
                return adapter.findMany(relatedModel, ids)

                    // do after transforms
                    .then(function (resources) {
                        return RSVP.all(resources.map(function (resource) {
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

        if (!req.body[collection]) return sendError(req, res, new JSONAPI_Error({status: 400, detail: 'incoming body payload is missing a primary resource collection'}));

        update = req.body[collection][0];
        if (!update || req.body[collection].length>1) return sendError(req, res, new JSONAPI_Error({status: 400, detail: 'incoming body payload needs exactly one entity in it\'s primary resource collection'}));

        // try to find the resource by ID
        adapter.find(model, id)

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

            },

            // resource not found, try to create it
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

    router.get(individualRoute, this.fnHandlers[individualRoute]["get"]);
    router.get(individualRouteResource, this.fnHandlers[individualRouteResource]["get"]);
    router.put(individualRoute, this.fnHandlers[individualRoute]["put"]);
    router.delete(individualRoute, this.fnHandlers[individualRoute]["delete"]);
    router.patch(individualRoute, this.fnHandlers[individualRoute]["patch"]);
    /*
     * POSTing a resource to a predetermined ID is not allowed,
     * since that is what PUT is for.
     */
    router.post(individualRoute, methodNotAllowed);

    //BEGIN FlyVector Port:
    /*
    * Append a top level "linked" object for hypermedia.
    *
    */

    function linkedIds(resources, path) {
        var ids = [];
        _.each(resources, function(resource) {
            if (resource.links && resource.links[path]) {
                var id = resource.links[path];
                if (_.isArray(id)) {
                    ids = ids.concat(id);
                } else {
                    ids.push(id);
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
        var ids = linkedIds(resources, key);
        if (ids.length > 0) {
            var type = _.isArray(schema[key]) ? schema[key][0] : schema[key];
            type = _.isPlainObject(type) ? type.ref : type;

            fetchedIds[type] = fetchedIds[type] || [];
            ids = _.without(ids, fetchedIds[type]);
            fetchedIds[type] = fetchedIds[type].concat(ids);

            return findResources.call(this,type,ids).then(function(resources) {
                return RSVP.all(resources.map(function(resource) {
                    //Make req,res optionally used; if not present, skip the after transform.
                    if(req && res){
                        return afterTransform(inflect.singularize(type), resource, req, res);
                    }else{
                        var deferred = RSVP.defer();
                        deferred.resolve(resource);
                        return deferred.promise;
                    }
                })).then(function() {
                    return {type: inflect.pluralize(type), resources: resources};
                });
            });
        }

        var deferred = RSVP.defer();
        deferred.resolve();
        return deferred.promise;
    }

    function fetchChildren(context,fetchedIds,body,config, resources, schema, req, res) {
        var _this=context;
        return RSVP.all(_.map(_.keys(config), function(key) {
            if (key !== "__includeInBody") {
                return getLinked.call(_this,fetchedIds, resources, schema, key, req, res)
                    .then(function(result) {
                        if (result) {
                            if (config[key].__includeInBody) {
                                body.linked[result.type] = body.linked[result.type] || [];
                                body.linked[result.type] = body.linked[result.type].concat(result.resources);
                            }
                            return fetchChildren(context,fetchedIds,body,config[key], result.resources, _this._schema[inflect.singularize(result.type)], req, res);
                        }
                    });
            }
        }));
    }

    //BEGIN FlyVector Port:
    /*
     * Append a top level "linked" object for hypermedia.
     * @param {Object} body deserialized response body
     *      * @param {Object} body deserialized response body

     * @return {Object} body
     */

    function appendLinked(body, inclusions, req, res) {
        var schemas = this._schema;
        var _this = this;
        var promises = [];

        // build of tree of paths to fetch and maybe include
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

        _.each(body, function(value, key) {
            if (key === 'meta' || key === 'links') return;
            var modelName = inflect.singularize(key)
            var schema = schemas[modelName];
            if (schema && inclusions) {
                var resources = body[key];
                var fetchedIds = {};
                body.linked = {};

                promises.push(fetchChildren(_this,fetchedIds,body,includePaths, resources, schema, req, res).then(function() {
                    return body;
                }));
            }

        });
        return RSVP.all(promises).then(function() {
            return body;
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

    function appendLinkForKey(body,key){
        var schema = _this._schema[options.inflect ? inflect.singularize(key) : key];
        var associations = getAssociations.call(_this, schema);

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
        var _this = this;
        var options = this.options;

        _.each(body, function (value, key) {
            if (key === 'meta') return;
            if (key === "linked" ){
                _.each(value,function(val,k){
                    appendLinkForKey(body,k);
                });

            }else{
                appendLinkForKey(body,key);
            }
        });
        return body;
    }

    this.appendLinks = appendLinks;
    return this;
}
/*
 * Get associations from a schema.
 *
 * @api private
 * @param {Object} schema
 * @return {Array}
 */
function getAssociations(schema) {
    var associations = [];
    var options = this.options;

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


/*
 * Expose the route method.
 */
module.exports = route;
