var _ = require('lodash');
var mongojs = require('mongojs');
var inflect = require('i')();
var sse = require('tiny-sse');
var Promise = require('bluebird');

var MultiSSE = function() {
};

MultiSSE.prototype.init = function(harvesterApp) {
    this.options = harvesterApp.options;
    this.db = mongojs(this.options.oplogConnectionString);
    this.coll = this.db.collection('oplog.rs');
    this.harvesterApp = harvesterApp;
    console.log('init')
    harvesterApp.router.get(this.options.baseUrl + '/changes/stream', sse.head(), sse.ticker({seconds: 3}), this.handler.bind(this));
};

MultiSSE.prototype.handler = function (req, res, next) {
    console.log('handler')
    var me = this;

    routeNames = req.query.resources ? req.query.resources.split(',') : [];

    var regex = new RegExp('.*\\.' + routeNames[0], 'i');

    this.getQuery(req, regex)
    .then(function(query) {
        var options = {
            tailable: true,
            awaitData: true
        };
        var stream = me.coll.find(query, options);

        console.log('xxxxxxxxxxxxx stream', query)

        stream.on('data', function (chunk) {
            console.log(chunk)

            var resourceName = new RegExp(inflect.pluralize(routeNames[0]));
            if (resourceName.test(chunk.ns)) {
                var model = me.harvesterApp.adapter.model(routeNames[0]);
                var data = me.harvesterApp.adapter._deserialize(model, chunk.o);
                var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();
                sse.send({id: id, event: routeNames[0] + '_' + chunk.op, data: data})(req, res);
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

MultiSSE.prototype.getQuery = function(req, ns) {
    console.log('xxxxxxxxxxxxxxxxxxxxxxxx');
    var lastEventId = req.headers['last-event-id'];
    var coll = this.db.collection('oplog.rs');
    var query = {
        ns : ns
    };
    return new Promise(function(resolve, reject) {
        console.log('xxxxxxxxxxxxxxxxxxxxxxxx')
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

module.exports = new MultiSSE;