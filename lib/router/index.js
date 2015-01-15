// system dependencies
var url = require('url');

// modules
var inflection = require('inflection');
var Negotiator = require('negotiator');

// local modules
var dispatch = require('./dispatch');
var lookupRelated = require('./lookup_related');
var handlers = {
  fetch: require('./handlers/fetch')
};


module.exports = function (instance) {
  return function (request, response) {
    Router.call(instance, request, response);
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

  // Initialize the context object, which will be passed around everywhere.
  var context = {
    query: route.query || {},
    mediaType: negotiator.mediaType(Object.keys(this.serializer.types)),
    type: !!this.options.inflect ? inflection.singularize(parts[0]) : parts[0],
    ids: (parts.length > 1 && parts[1].length) ? parts[1].split(',') : null
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
        return lookupRelated.call(_this, context, parts[2]);
      },
      get: handlers.fetch
    }
  ];


  // accept header must suit the serializers
  if (!context.mediaType) {
    response.writeHead(406);
    return response.end();
  }


  // ignore trailing slash
  if (parts[parts.length - 1] === '') {
    parts.pop();
  }


  // handle the route
  if (parts.length <= routes.length &&
    (parts.length === 0 || this.schemas.hasOwnProperty(context.type))) {
    var routeObject = routes[parts.length];

    if (!!routeObject[method]) {
      return (!!routeObject._process ?
        routeObject._process() : Promise.resolve()).then(function () {
        return dispatch.call(_this, routeObject[method],
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
