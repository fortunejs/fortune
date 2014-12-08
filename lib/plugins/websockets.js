
var namespaces = {};

// XXX change the port, probably extracted from somewhere
var io = require('socket.io').listen(4000);

// We will use socket.io "namespaces" for different resources,
// since we'll probably have more than one user wanting to have updates
// on the same resource.
// Users connect their socket.io clients to the resourceName they are
// interested in: io.connect(baseURL + ":" + port + '/person');
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
          case "PATCH":
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
          data: datapoint
        };

        if (!namespaces.hasOwnProperty(config.resourceName)) {
          return this;
        }

        // we inform everyone in "resourceName" namespace
        // that the event has happened
        namespaces[config.resourceName].emit(eventType, payload);

        return this;

      };
    }
  }

];

exports.setup = function(app, resource) {

  // add a namespace for this resource;
  namespaces[resource.name] = io.of('/'+resource.name);

  // register the hooks
  app.afterWrite(resource.name, hooks, {
    informSubscribers :
      {
        resourceName: resource.name
      }
  });
};


exports.hooks = hooks;