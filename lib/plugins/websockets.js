var _ = require('lodash');
var RSVP = require('rsvp');
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

          // we inform everyone in "resourceName" namespace
          // that the event has happened

          _.each(namespaces[config.namespace].connected, function(connection){
            var matched = sift(app.adapter.parseQuery(config.resource, connection.handshake.fortuneQuery.filter), [datapoint]);
            if (matched.length){
              var includes = connection.handshake.fortuneQuery.include;
              resolveIncludes(includes).then(function(linked){
                //Read linked resources if query has ?include
                //Append to "linked" section
                var payload = {};
                payload[config.namespace] = matched;
                if (linked) payload.linked = linked;
                connection.emit(eventType, payload);
              });
            }
          });

          function resolveIncludes(include){
            return new RSVP.Promise(function(resolve){
              if (!include) return resolve();
              var parts = include.split(',');
              var schema = app._resources[config.resource].schema;
              RSVP.all(_.map(parts, function(path){
                var ref = schema[path];
                if (!ref || ref.external || (ref[0] && ref[0].external)) return;
                var collection = app._resources[_.isArray(ref) ? ref[0].ref : ref.ref].route;
                return app.direct.get(collection, {}).then(function(res){
                  return res.body;
                });
              })).then(function(results){
                resolve(_.reduce(results, function(memo, res){
                  _.extend(memo, res);
                  delete memo.links;
                  return memo;
                }, {}));
              });
            });
          }

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