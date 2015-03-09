var mongojs = require('mongojs');
var inflect = require('i')();
var _ = require('lodash');
var SSE = function() {
};

SSE.prototype.init = function(router, adapter, options) {
  this.router = router;
  this.adapter = adapter;
  this.options = options;
  this.db = mongojs((process.env.OPLOG_MONGODB_URL || process.argv[3]) + '?slaveOk=true');
}

SSE.prototype.initRoute = function(routeName) {
  this.router.get(routeName + '/changes/stream', this.handler.bind(this));
};

SSE.prototype.handler = function(req, res) {
    var me = this;
    var routeName = /\/(.+)\/changes\/stream/.exec(req.route.path)[1];
    var query = {
      ns : this.options.db + '.' + routeName,
    };
    
    if (req.query.event) query.op = req.query.event;

    var lastEventId = req.headers['last-event-id'];
    if (req.headers['last-event-id']) {
      var tsSplit = _.map(lastEventId.split('_'), function(item) {
        return parseInt(item, 10);
      });

      query.ts = {
        $gt : new mongojs.Timestamp(tsSplit[1], tsSplit[0])
      };
    }
    var coll = this.db.collection('oplog.rs');
    var options = {
      tailable : true,
      awaitData : true
    };
    
    this.writeSSEHead(req, res, function() {
      var stream = coll.find(query).sort({$natural : -1}).limit(parseInt(req.query.limit, 10));
      var count = 0;
      stream.on('data', function (chunk) {
        var singularKey = me.options.inflect ? inflect.singularize(routeName) : routeName;
        var model = me.adapter.model(singularKey);
        var data = me.adapter._deserialize(model, chunk.o)
        var id = chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits();

        me.writeSSEData(req, res, id, chunk.op, data);
      });
      stream.on('end', function () {
          res.end();
      });
      stream.on('err', function () {
          res.end();
      });
      res.on('close', function () {
          res.end();
      });
    });

};

SSE.prototype.writeSSEHead = function (req, res, next) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });
    res.write("retry: 10000\n");
    return next(req, res);
};

SSE.prototype.writeSSEData = function (req, res, id, event, data) {
    res.write("id: " + id + '\n');
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
};

module.exports = new SSE;
