var RouteMethod = function(options) {
  this.options = options;

  RouteMethod.prototype.register = function() {
    var handlers = this.options.handlers;
    var route = this.options.route;
    var method = this.options.method;

    if (this.options.notAllowed) {
      return this.options.router[method](route, methodNotAllowed);
    }

    this.options.router[method](this.options.route, handlers[route][method]);
  };

  RouteMethod.prototype.authorize = function() {

  };

  RouteMethod.prototype.before = function() {

  };

  var methodNotAllowed = function (req, res) {
      sendError(req, res, new JSONAPI_Error({status: 405}));
  };
};

module.exports = RouteMethod;