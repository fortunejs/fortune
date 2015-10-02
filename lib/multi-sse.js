var _ = require('lodash');
var mongojs = require('mongojs');
var inflect = require('i')();
var tinySSE = require('tiny-sse');
var SSE = require('./sse');
var Promise = require('bluebird');
var hl = require('highland');

var MultiSSE = function() {
};

MultiSSE.prototype.init = function(harvesterApp) {
    this.options = harvesterApp.options;
    this.db = mongojs(this.options.oplogConnectionString);
    this.coll = this.db.collection('oplog.rs');
    this.harvesterApp = harvesterApp;
    harvesterApp.router.get(this.options.baseUrl + '/changes/stream', this.checkValidRequestMiddleware.bind(this), tinySSE.head(), tinySSE.ticker({seconds: 3}), this.handler.bind(this));
};

MultiSSE.prototype.checkValidRequestMiddleware = function (req, res, next) {
    routeNames = req.query.resources ? req.query.resources.split(',') : [];
    if (routeNames.length === 0 || !this.allResourcesExist(routeNames)) {
        return res.send(400);
    }

    next();
};

MultiSSE.prototype.handler = function (req, res, next) {
    var me = this;

    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    var regex = new RegExp('.*\\.(' + routeNames.join('|') + ')', 'i');
    var docStream = hl();

    SSE.getQuery(req, regex)
    .then(function(query) {
        var options = {
            tailable: true,
            awaitData: true
        };
        var stream = me.coll.find(query, options);

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
                var model = me.harvesterApp.adapter.model(routeNames[0]);
                var data = me.harvesterApp.adapter._deserialize(model, chunk.o);
                var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();
                console.log(id)
                tinySSE.send({id: id, event: routeNames[0] + '_' + chunk.op, data: data})(req, res);
                next();
            }
        });

        docStream.through(consume);
    })
    .catch(function(err) {
        res.end();
        docStream.end();
    });
};

MultiSSE.prototype.allResourcesExist = function(resourceNames) {
    
    var harvesterResourceNames = _.keys(this.harvesterApp.createdResources);

    return _.all(resourceNames, function(resourceName) {
        return _.contains(harvesterResourceNames, resourceName);
    });
};

module.exports = new MultiSSE;