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
  var _this = this;
  var negotiator = new Negotiator(request);
  var route = url.parse(request.url, true);
  var parts = route.pathname.slice(1).split('/');
  var method = (request.method || '').toLowerCase();
  var context = {
    type: parts[0],
    query: route.query,
    mediaType: negotiator.mediaType(Object.keys(this.serializer.types))
  };

  if (!context.mediaType) {
    response.writeHead(406);
    return response.end();
  }

  if (!!this.options.inflect) {
    context.type = inflection.singularize(context.type);
  }

  if (!context.type.length && parts.length === 1) {

    if (method === 'get') return dispatcher(this.serializer.showIndex);
    else {
      response.writeHead(403);
      return response.end();
    }

  } else if (this.schemas.hasOwnProperty(context.type) && parts.length === 2) {

    context.ids = parts[1].split(',');

    if (method === 'get') return dispatcher(handlers.fetch);
    else {
      response.writeHead(403);
      return response.end();
    }

  } else {

    response.writeHead(404);
    return response.end();

  }

  function dispatcher (fn) {
    return dispatch.call(_this, fn, context, request, response);
  }
}
