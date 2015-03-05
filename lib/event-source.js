var mongojs = require('mongojs');

var EventSource = function() {
};

EventSource.prototype.init = function(router) {
  this.router = router;
  console.log(process.env.OPLOG_MONGODB_URL || process.argv[3])
  this.db = mongojs((process.env.OPLOG_MONGODB_URL || process.argv[3]) + '?slaveOk=true');
}

EventSource.prototype.initRoute = function(routeName) {
  this.router.get(routeName + '/changes', this.handler.bind(this));
};

EventSource.prototype.handler = function(req, res) {
    var me = this;
    var query = {}
    var coll = this.db.collection('oplog.rs');
    var options = {
          tailable: true,
          awaitData: true
    };
    
    this.writeSSEHead(req, res, function() {
      var stream = coll.find(query, options);

      stream.on('data', function (chunk) {
          me.writeSSEData(req, res, {}, {test : true})
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

EventSource.prototype.writeSSEData = function (req, res, event, data, next) {
    var id = (new Date()).toLocaleTimeString();
    res.write("id: " + id + '\n');
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
    if (next) {
        return next(req, res);
    }
};

module.exports = new EventSource;
