// system dependencies
var url = require('url');


// modules
var inflection = require('inflection');


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
  var route = url.parse(request.url, true);
  var parts = route.pathname.slice(1).split('/');
  var type = parts[0];
  var method = (request.method || '').toLowerCase();
  var schemas = this.schemas;
  var context;

  if (!!this.options.inflect) {
    type = inflection.singularize(type);
  }

  if (!type.length && parts.length === 1) {

    if (method === 'get') return dispatcher(this.serializer.showIndex);
    else {
      response.writeHead(403);
      response.end();
    }

  } else if (schemas.hasOwnProperty(type) && parts.length === 2) {
    context = {
      type: type,
      ids: parts[1].split(','),
      query: route.query
    };

    if (method === 'get') return dispatcher(handlers.fetch, context);

  } else {

    response.writeHead(404);
    response.end();

  }

  function dispatcher (fn, context) {
    return dispatch.call(_this, fn, context, request, response);
  }
}
