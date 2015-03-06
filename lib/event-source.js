var mongojs = require('mongojs');
var inflect = require('i')();

var EventSource = function() {
};

EventSource.prototype.init = function(router, adapter, options) {
  this.router = router;
  this.adapter = adapter;
  this.options = options;
  this.db = mongojs((process.env.OPLOG_MONGODB_URL || process.argv[3]) + '?slaveOk=true');
}

EventSource.prototype.initRoute = function(routeName) {
  this.router.get(routeName + '/changes', this.handler.bind(this));
};

EventSource.prototype.handler = function(req, res) {
    var me = this;
    var routeName = /\/(.+)\/changes/.exec(req.route.path)[1];
    var query = {
      ns : this.options.db + '.' + routeName,
    };
    console.log(req.query)
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
        me.writeSSEData(req, res, chunk.ts, chunk.op, data);
      });
      stream.on('end', function () {
          res.end();
      });
      stream.on('err', function () {
        console.log('ERRRRRR')
          res.end();
      });
      res.on('close', function () {
          console.log('response closed');
      });
    });

};

EventSource.prototype.writeSSEHead = function (req, res, next) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });
    res.write("retry: 10000\n");
    return next(req, res);
};

EventSource.prototype.writeSSEData = function (req, res, id, event, data) {
    res.write("id: " + id + '\n');
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
};

module.exports = new EventSource;
