var sift = require('sift');
var io;

exports.setup = function(app, resource) {
   if (!app.options.websockets || !app.options.websockets.enable) return;

  var namespaces = {};

  if (!io){
    io = require('socket.io').listen(app.options.websockets.port || 4000);
  }

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



          if (!namespaces.hasOwnProperty(config.resourceName)) {
            return this;
          }


          function informSubscribers(socket, req, eventType){
            var matched = sift(app.adapter.parseQuery(config.resourceName, req.query.filter), [datapoint]);
            if (matched.length){
              var payload = {
                data: matched[0]
              };
              socket.emit(eventType, payload);
            }
          }

          // we inform everyone in "resourceName" namespace
          // that the event has happened
          informSubscribers(namespaces[config.resourceName], req, eventType);
          //namespaces[config.resourceName].emit(eventType, payload);

          return this;

        };
      }
    }

  ];

  // add a namespace for this resource;
  namespaces[resource.name] = io.of('/' + resource.name);

  // register the hooks
  app.afterWrite(resource.name, hooks, {
    informSubscribers: {
      resourceName: resource.name
    }
  });
};