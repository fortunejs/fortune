var _ = require('lodash');
var mongojs = require('mongojs');
var inflect = require('i')();
var tinySSE = require('tiny-sse');
var SSE = require('./sse');
var Promise = require('bluebird');
var hl = require('highland');
var JSONAPI_Error = require('./jsonapi-error');

var MultiSSE = function() {
};

MultiSSE.prototype.init = function(harvesterApp) {
    this.options = harvesterApp.options;
    this.db = mongojs(this.options.oplogConnectionString);
    this.coll = this.db.collection('oplog.rs');
    this.harvesterApp = harvesterApp;
    harvesterApp.router.get(this.options.baseUrl + '/changes/stream', this.requestValidationMiddleware.bind(this), tinySSE.head(), tinySSE.ticker({seconds: 3}), this.handler.bind(this));
};

MultiSSE.prototype.requestValidationMiddleware = function (req, res, next) {
    routeNames = req.query.resources ? req.query.resources.split(',') : [];

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

MultiSSE.prototype.handler = function (req, res, next) {
    var that = this;

    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    var regex = new RegExp('.*\\.(' + routeNames.join('|') + ')', 'i');
    var docStream = hl();

    SSE.getQuery(req, regex)
    .then(function(query) {
        var options = {
            tailable: true,
            awaitData: true
        };
        var stream = that.coll.find(query, options);

        var docStream = hl(function (push, next) {
            setTimeout(function() {
                var val = stream.read();
                if (!val) return next();

                push(null, val);
                next();
            });
        });

        
        docStream.resume();

        var consume = hl().consume(function(err, chunk, push, next) {
            var resourceNames = _.map(routeNames, function(routeName) {
                return new RegExp(inflect.pluralize(routeName));
            });

            var matchesEitherResource = _.some(resourceNames, function(resourceName) {
                return resourceName.test(chunk.ns);
            });

            if (matchesEitherResource) {
                var model = that.harvesterApp.adapter.model(routeNames[0]);
                var data = that.harvesterApp.adapter._deserialize(model, chunk.o);
                var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();
                
                tinySSE.send({id: id, event: routeNames[0] + '_' + chunk.op, data: data})(req, res);
                next();
            }
        });

        docStream.through(consume);
    })
    .catch(function(err) {
        console.log(err.stack);
        res.end();
        docStream.end();
    });
};

MultiSSE.prototype.allResourcesExist = function(resourceNames) {
    return this.getMissingResources(resourceNames).length === 0;
};

MultiSSE.prototype.getMissingResources = function(resourceNames) {

    var harvesterResourceNames = _.keys(this.harvesterApp.createdResources);

    return _.difference(resourceNames, harvesterResourceNames);
}

module.exports = new MultiSSE;