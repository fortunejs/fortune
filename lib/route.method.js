var SSE = require('./sse');

var RouteMethod = function(options) {
  this.options = options;

  RouteMethod.prototype.register = function() {
    var handlers = this.options.handlers;
    var route = this.options.route;
    var method = this.options.method;

    this.handler = methodNotAllowed;

    if (this.options.sse) {
      SSE.initRoute(route);
      return this;
    }

    if (this.options.notAllowed) {
        this.options.router[method](route, this.handler);
    } else {
      this.handler = handlers[route][method];
      this.options.router[method](this.options.route, this.handler);
    }
  };

  RouteMethod.prototype.authorize = function(authorizeFunc) {
    this.authorizeFunc = authorizeFunc;
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

  RouteMethod.prototype.handler = function() {
    return this.handler;
  };

  RouteMethod.prototype.validate = function(validateFunc) {
    this.validateFunc = validateFunc;
    return this;
  };

  var methodNotAllowed = function (req, res) {
      sendError(req, res, new JSONAPI_Error({status: 405}));
  };

  return function() {
    return this;
  }.bind(this)
};

module.exports = RouteMethod;