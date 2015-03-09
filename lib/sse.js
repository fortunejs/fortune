var mongojs = require('mongojs');
var inflect = require('i')();
var _ = require('lodash');
var SSE = function () {
};

SSE.prototype.init = function (router, adapter, options) {
    this.router = router;
    this.adapter = adapter;
    this.options = options;
    this.db = mongojs((process.env.OPLOG_MONGODB_URL || process.argv[3]) + '?slaveOk=true');
}

var sse = require('tiny-sse');


SSE.prototype.initRoute = function (routeName) {
    this.router.get(routeName + '/changes/stream', sse.head(), sse.ticker({seconds: 3}), this.handler.bind(this));
};

SSE.prototype.handler = function (req, res, next) {
    var me = this;
    var routeName = /\/(.+)\/changes\/stream/.exec(req.route.path)[1];

    var regex = new RegExp('.*\\.' + routeName, 'i');

    var query = {
        ns: regex
    };

    var lastEventId = req.headers['last-event-id'];
    if (req.headers['last-event-id']) {
        var tsSplit = _.map(lastEventId.split('_'), function (item) {
            return parseInt(item, 10);
        });
        console.log('query=' + tsSplit[1] + ' ' + tsSplit[0])
        query.ts = {
            $gt: new mongojs.Timestamp(tsSplit[1], tsSplit[0])
        };
    }
    var coll = this.db.collection('oplog.rs');
    var options = {
        tailable: true,
        awaitData: true
    };

    var stream = coll.find(query, options);

    stream.on('data', function (chunk) {

        if (regex.test(chunk.ns)) {
            var singularKey = me.options.inflect ? inflect.singularize(routeName) : routeName;
            var model = me.adapter.model(singularKey);
            var data = me.adapter._deserialize(model, chunk.o);
            var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();

            sse.send({id: id, event: routeName + '_' + chunk.op, data: data})(req, res);
        }
    });
    stream.on('end', function () {
        res.end();
    });
    stream.on('err', function () {
        res.end();
    });
    res.on('close', function () {
        stream.destroy();
    });

};


module.exports = new SSE;
