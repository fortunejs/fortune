var mongojs = require('mongojs');
var sse = require('tiny-sse');

var EventSource = function() {
};

EventSource.prototype.init = function(router) {
  this.router = router;
  console.log(process.env.OPLOG_MONGODB_URL || process.argv[3])
  this.db = mongojs((process.env.OPLOG_MONGODB_URL || process.argv[3]) + '?slaveOk=true');
}

EventSource.prototype.initRoute = function(routeName) {
  this.router.get(routeName + '/changes', sse.head(), sse.ticker({seconds: 3}), this.handler.bind(this));
};

EventSource.prototype.handler = function(req, res) {
    var query = {}
    var coll = this.db.collection('oplog.rs');
    var options = {
          tailable: true,
          awaitData: true
    };


    var stream = coll.find(query, options);

    console.log('here')
    stream.on('data', function (chunk) {
        console.log('data')
        sse.send({id: chunk.ts, event: 'foo_event', data: chunk})(req, res);

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
};

module.exports = new EventSource;
