
var subscriptions = {};

// XXX change the port, probably extracted from somewhere
var io = require('socket.io').listen(4000);

// We will use socket.io "rooms" as a metaphor for different resources,
// since we'll probably have more than one user wanting to have updates
// on the same "element".
var hooks = [
  {
    name: 'informSubscribers',
    init: function(config) {
      return function(req) {
        var datapoint = this;
        var eventType = "";

        switch (req.method) {
          case "POST":
            eventType = "add";
            break;
          case "PUT":
            eventType = "update";
            break;
          case "DELETE":
            eventType = "delete";
            break;
        }

        if (!eventType) {
          return this;
        }

        var payload = {
          data: this
        };

        // we inform everyone in "resourceName" room
        // that the event has happened (i.e. )
        // console.log(config.resourceName, eventType);
        io.to(config.resourceName).emit(eventType, payload);

        return this;

      }
    }
  }

];

// setup the resource watching
io.on('connection', function(socket) {
  socket.on('watch', function(resourceName) {
    console.log("joining room", resourceName)
    socket.join(resourceName);
  });
});


exports.setup = function(app, resource) {


  // register the hooks
  app.afterWrite(resource.name, hooks, {
    informSubscribers :
      {
        resourceName: resource.name
      }
  });
};


exports.hooks = hooks;