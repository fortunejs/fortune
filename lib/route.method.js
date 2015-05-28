var SSE = require('./sse');

var RouteMethod = function(options) {
  this.options = options;

  RouteMethod.prototype.register = function() {
    var handlers = this.options.handlers;
    var route = this.options.route;
    var method = this.options.method;

    if (this.options.sse) {
      SSE.initRoute(route);
      return this;
    }

    if (this.options.notAllowed) {
        this.options.router[method](route, methodNotAllowed);
    } else {
      this.options.router[method](this.options.route, handlers[route][method]);
    }
  };

  RouteMethod.prototype.authorize = function() {
    return this;
  };

  RouteMethod.prototype.before = function(beforeFunc) {
    this.beforeFunc = beforeFunc;
    return this;
  };

  RouteMethod.prototype.after = function(afterFunc) {
    this.afterFunc = beforeFunc;
    return this;
  };

  var methodNotAllowed = function (req, res) {
      sendError(req, res, new JSONAPI_Error({status: 405}));
  };
};

module.exports = RouteMethod;