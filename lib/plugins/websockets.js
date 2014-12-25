var sift = require('sift');
var io;

exports.setup = function(app, resource) {
   if (!app.options.enableWebsockets) return;

  var namespaces = {};

  if (!io){
    io = app.io;
    /*io.set('authorization', function(data, callback){
      console.log(data);
      callback(null, true);
    });*/
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



          if (!namespaces.hasOwnProperty(config.namespace)) {
            return this;
          }


          function informSubscribers(socket, req, eventType){
            var matched = sift(app.adapter.parseQuery(config.resource, {}), [datapoint]);
            if (matched.length){
              var payload = {
                data: matched[0]
              };
              socket.emit(eventType, payload);
            }
          }

          // we inform everyone in "resourceName" namespace
          // that the event has happened
          informSubscribers(namespaces[config.namespace], req, eventType);
          //namespaces[config.resourceName].emit(eventType, payload);

          return this;

        };
      }
    }

  ];

  // add a namespace for this resource;
  namespaces[resource.route] = io.of('/' + resource.route);

  // register the hooks
  app.afterWrite(resource.name, hooks, {
    informSubscribers: {
      resource: resource.name,
      namespace: resource.route
    }
  });
};