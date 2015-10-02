var _ = require('lodash');
var mongojs = require('mongojs');
var inflect = require('i')();
var tinySSE = require('tiny-sse');
var SSE = require('./sse');
var Promise = require('bluebird');

var MultiSSE = function() {
};

MultiSSE.prototype.init = function(harvesterApp) {
    this.options = harvesterApp.options;
    this.db = mongojs(this.options.oplogConnectionString);
    this.coll = this.db.collection('oplog.rs');
    this.harvesterApp = harvesterApp;
    harvesterApp.router.get(this.options.baseUrl + '/changes/stream', tinySSE.head(), tinySSE.ticker({seconds: 3}), this.handler.bind(this));
};

MultiSSE.prototype.handler = function (req, res, next) {
    var me = this;

    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    var regex = new RegExp('.*\\.(' + routeNames.join('|') + ')', 'i');

    SSE.getQuery(req, regex)
    .then(function(query) {
        var options = {
            tailable: true,
            awaitData: true
        };
        var stream = me.coll.find(query, options);

        console.log('xxxxxxxxxxxxx stream', query)

        stream.on('data', function (chunk) {

            var resourceNames = _.map(routeNames, function(routeName) {
                return new RegExp(inflect.pluralize(routeName));
            });

            console.log(chunk.ns,resourceNames);

            var matchesEitherResource = _.some(resourceNames, function(resourceName) {
                return resourceName.test(chunk.ns);
            });

            console.log(chunk.o.name, matchesEitherResource)
            if (matchesEitherResource) {
                var model = me.harvesterApp.adapter.model(routeNames[0]);
                var data = me.harvesterApp.adapter._deserialize(model, chunk.o);
                var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();
                tinySSE.send({id: id, event: routeNames[0] + '_' + chunk.op, data: data})(req, res);
            }
        });
        stream.on('end', function () {
            console.log('end')
            res.end();
        });
        stream.on('err', function () {
            console.log('err')
            res.end();
        });
        res.on('close', function () {
            console.log('close')
            stream.destroy();
        });
    })
    .catch(function(err) {
        console.log(err.stack)
        res.end();
    });
};

module.exports = new MultiSSE;