var _ = require('lodash');
var mongojs = require('mongojs');
var inflect = require('i')();
var tinySSE = require('tiny-sse');
var Promise = require('bluebird');
var hl = require('highland');
var JSONAPI_Error = require('./jsonapi-error');

var SSE = function() {
};

SSE.prototype.init = function(config) {
    this.config = config;
    this.options = config.context.options;
    this.harvesterApp = config.context;

    //wraps it up in an array of single item, so that it fits the current logic without too many conditions
    this.singleResourceName = config.singleResourceName && [config.singleResourceName];
    this.db = mongojs(this.options.oplogConnectionString);
    this.coll = this.db.collection('oplog.rs');
    
    var routePrefix = (config.singleResourceName) ? '/' + inflect.pluralize(config.singleResourceName) : '';

    this.harvesterApp.router.get(this.options.baseUrl + routePrefix + '/changes/stream', this.requestValidationMiddleware.bind(this), tinySSE.head(), tinySSE.ticker({seconds: 3}), this.handler.bind(this));
};

SSE.prototype.requestValidationMiddleware = function (req, res, next) {
    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    if (this.singleResourceName) {
        routeNames = this.singleResourceName;
    }

    if (routeNames.length === 0) {
        throw new JSONAPI_Error({
            status: 400,
            title: 'Requested changes on missing resource',
            detail: 'You have not specified any resources, please do so by providing "resource?foo,bar" as query'
        });
    }

    if (!this.allResourcesExist(routeNames)) {
        throw new JSONAPI_Error({
            status: 400,
            title: 'Requested changes on missing resource',
            detail: 'The follow resources don\'t exist ' +  this.getMissingResources(routeNames).join(',')
        });
    }

    if (req.headers['last-event-id']) {
        var tsSplit = _.map(req.headers['last-event-id'].split('_'), function (item) {
            return parseInt(item, 10);
        });

        isValidTS = _.all(tsSplit, function(ts) {
            return !isNaN(ts);
        });

        if(!isValidTS) {
            throw new JSONAPI_Error({
                status: 400,
                title: 'Invalid Timestamp',
                detail: 'Could not parse the time stamp provided'
            });
        }
    }

    next();
};

SSE.prototype.handler = function (req, res, next) {

    var that = this;

    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    if (this.singleResourceName) {
        routeNames = this.singleResourceName;
    }

    var regex = new RegExp('.*\\.(' + routeNames.join('|') + ')', 'i');
    var docStream = hl();

    this.getQuery(req, regex)
    .then(function(query) {
        var options = {
            tailable: true,
            awaitData: true
        };

        console.log(query, routeNames)
        var stream = that.coll.find(query, options);

        var docStream = hl(stream);

        docStream.resume();

        var consume = hl().consume(function(err, chunk, push, next) {
            var resourceNames = _.map(routeNames, function(routeName) {
                return new RegExp(inflect.pluralize(routeName));
            });

            console.log(req.query, resourceNames)

            var matchesEitherResource = _.some(resourceNames, function(resourceName) {
                return resourceName.test(chunk.ns);
            });

            console.log('handler', matchesEitherResource)
            if (matchesEitherResource) {
                var model = that.harvesterApp.adapter.model(routeNames[0]);
                var data = that.harvesterApp.adapter._deserialize(model, chunk.o);
                var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();

                 var filters = that.getFilters(req);

                 var passedFilter = _.reduce(filters, function(obj, filter) {
                     return _.filter([data], _.matches(filter));
                 }, true);

                //if we have filters, make sure they are passed
                if (passedFilter.length > 0 || filters.length === 0) {
                    tinySSE.send({id: id, event: routeNames[0] + '_' + chunk.op, data: data})(req, res);
                }

                next();
            }
        });

        docStream.through(consume).errors(function(err) {
            that.handleError(err, res, docStream);
        });
    })
    .catch(function(err) {
        that.handleError(err, res, docStream);
    });
};

SSE.prototype.handleError = function(err, res, docStream) {
    console.log(err.stack);
    res.end();
    if(docStream) {
        docStream.destroy();
    }
};

SSE.prototype.allResourcesExist = function(resourceNames) {
    return this.getMissingResources(resourceNames).length === 0;
};

SSE.prototype.getMissingResources = function(resourceNames) {

    var harvesterResourceNames = this.resourceName || _.keys(this.harvesterApp.createdResources);

    return _.difference(resourceNames, harvesterResourceNames);
}

SSE.prototype.getQuery = function(req, ns) {
    var lastEventId = req.headers['last-event-id'];
    var coll = this.db.collection('oplog.rs');
    var query = {
        ns : ns
    };
    return new Promise(function(resolve, reject) {
        if (req.headers['last-event-id']) {
            var tsSplit = _.map(lastEventId.split('_'), function (item) {
                return parseInt(item, 10);
            });

            query.ts = {
                $gt: new mongojs.Timestamp(tsSplit[1], tsSplit[0])
            };

            return resolve(query);
        }


        coll.find(query).sort({$natural : -1}).limit(1, function(err, items) {
            if (err) return reject(err);

            if(items.length === 0) {
                return coll.find().sort({$natural : -1}).limit(1, function(err, items) {
                    if (err) return reject(err);

                    query.ts = {
                        $gt: items[0].ts
                    };

                    return resolve(query);
                });
            }

            query.ts = {
                $gt: items[0].ts
            };

            return resolve(query);
        });
    });
};

SSE.prototype.getFilters = function(req) {

    var filters = _.chain(req.query)
    .map(function(item, key) {
        if (!_.contains(['limit', 'sort', 'offset', 'resources'], key)) {
            var filter = {};
            filter[key] = item;
            return filter;
        }
    })
    .filter(function(item) {
        return !!item;
    })
    //converts {'foo.bar' : 'foobar'} to {foo : { bar : 'foobar' }}
    .map(function(item) {
        var keys = _.keys(item)[0].split('.');
        return _.reduce(keys, function(obj, key, index) {

            var value = (index === keys.length - 1 || keys.length === 1) ? _.values(item)[0] : {};

            if (index === 0) {
                obj[key] = (keys.length > 1) ? {} : value;
            } else {
                obj[keys[index - 1]][key] = value;
            }
            return obj;
        }, {});
    })
    .value();

    return filters;

}

module.exports = SSE;
