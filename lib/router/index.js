// system dependencies
var url = require('url');


// modules
var inflection = require('inflection');
var Negotiator = require('negotiator');


// local modules
var dispatch = require('./dispatch');
var handlers = {
  fetch: require('./handlers/fetch')
};


module.exports = function (context) {
  return function (request, response) {
    Router.call(context, request, response);
  };
};


/**
 * Basic route matching.
 *
 * @param {Object} request
 * @param {Object} response
 */
function Router (request, response) {
  request.timestamp = Date.now();

  var _this = this;
  var negotiator = new Negotiator(request);
  var route = url.parse(request.url, true);
  var parts = route.pathname.slice(1).split('/');
  var method = (request.method || '').toLowerCase();

  var context = {
    query: route.query || {},
    mediaType: negotiator.mediaType(Object.keys(this.serializer.types)),
    type: !!this.options.inflect ? inflection.singularize(parts[0]) : parts[0],
    ids: parts.length > 1 ? parts[1].split(',') : null
  };

  // an array of all possible routes, ordered by depth
  var routes = [
    // index
    {
      get: this.serializer.showIndex
    },
    // collection
    {
      get: handlers.fetch
    },
    // individual resources
    {
      get: handlers.fetch
    },
    // related resources
    {
      // perform initial lookup
      _process: function () {
        var field = parts[2];
        var relatedType = _this.schemas[context.type][field].link;
        var fields = {};

        fields[field] = 1;

        return _this.adapter.find(context.type, context.ids, {
          fields: fields
        }).then(function (entities) {
          var relatedIds = [];

          entities.forEach(function (entity) {
            var ids = Array.isArray(entity[field]) ?
              entity[field] : [entity[field]];

            ids.forEach(function (id) {
              if (!!id && !~relatedIds.indexOf(id)) relatedIds.push(id);
            });
          });

          context.ids = relatedIds;
          context.type = relatedType;

          return Promise.resolve();
        });
      },
      get: handlers.fetch
    }
  ];


  // accept header must suit the serializers
  if (!context.mediaType) {
    response.writeHead(406);
    return response.end();
  }


  // if it's the index, there should be no parts
  if (parts[parts.length - 1] === '') {
    parts.pop();
  }


  // handle the route
  if (parts.length <= routes.length &&
    (parts.length === 0 || this.schemas.hasOwnProperty(context.type))) {
    if (!!routes[parts.length][method]) {
      return (!!routes[parts.length]._process ?
        routes[parts.length]._process() : Promise.resolve()).then(function() {
        dispatch.call(_this, routes[parts.length][method],
          context, request, response);
      });
    } else {
      response.writeHead(405);
      return response.end();
    }
  } else {
    response.writeHead(404);
    return response.end();
  }
}
