var Promise = require('bluebird');

var SSE = require('./sse');
var JSONAPI_Error = require('./jsonapi-error.js');
var sendError = require('./send-error');

function methodNotAllowed(req, res) {
    sendError(req, res, new JSONAPI_Error({status: 405}));
}

/**
 * Create expressJS route handler.
 *
 * Depending on configuration it may leverage global authorizationStrategy
 * or not.
 * Then it delegates to apropriate handlerFunc configured during `register()`.
 *
 * @param routeMethod
 * @returns {Function} expressJS route handler
 */
function createRouteInterceptor(routeMethod) {
    return function routeInterceptor(request, response) {
        var authorizationStrategy = routeMethod.options.harvester.authorizationStrategy;
        var thatRouteInterceptorContext = this;
        //noinspection UnnecessaryLocalVariableJS
        var thatRouteInterceptorArguments = arguments;

        function callRouteHandler() {
            routeMethod.handlerFunc.apply(thatRouteInterceptorContext, thatRouteInterceptorArguments);
        }

        function isAuthorizationRequired() {
            return authorizationStrategy instanceof Function && routeMethod.authorizationRequired !== false;
        }

        /**
         * This function is meant to be invoked in promise chain, which means that any exception thrown by callRouteHandler will not get out of routeInterceptor
         * (will be swallowed), so we need to close the connection with proper error sent to client.
         */
        function safelyCallRouteHandler() {
            try {
                callRouteHandler();
            } catch (error) {
                console.error('This should never happen, but route handler for', routeMethod.options.method, routeMethod.options.route, 'threw exception!!');
                sendError(request, response, error);
            }
        }

        function handleAuthorizationResult(authorizationResult) {
            /*if the result is a promise*/
            if (authorizationResult != null && authorizationResult.then instanceof Function) {
                authorizationResult.then(safelyCallRouteHandler).catch(function () {
                    sendError(request, response, new JSONAPI_Error({status: 403}));
                });
            } else {
                /*if the result is not a promise*/
                sendError(request, response, authorizationResult);
            }
        }

        if (isAuthorizationRequired()) {
            handleAuthorizationResult(authorizationStrategy(request, routeMethod.getPermission()));
        } else {
            callRouteHandler();
        }
    };
}

function RouteMethod(options) {
    if (options.harvester == null) {
        throw new Error('Options must include reference to harvester (property harvester)');
    }
    if (options.resourceName == null) {
        throw new Error('Options must include resource name (property resourceName)');
    }
    this.options = options;
    this.authorizationRequired = true;
    /**
     * The DSL defines: harvesterApp.getById(), so instead of returning this object we need to return function that, when called, will return this object.
     */
    var that = this;
    return function () {
        return that;
    }
}

RouteMethod.prototype.register = function () {
    var handlers = this.options.handlers;
    var route = this.options.route;
    var method = this.options.method;
    var thatRouteMethod = this;

    if (this.options.sse) {
        SSE.initRoute(route);
        return this;
    }

    if (this.options.notAllowed) {
        this.handlerFunc = methodNotAllowed;
        this.options.harvester.router[method](route, methodNotAllowed);
    } else {
        this.handlerFunc = handlers[route][method];
        this.options.harvester.router[method](this.options.route, createRouteInterceptor(thatRouteMethod));
    }
    return this;
};

RouteMethod.prototype.disableAuthorization = function () {
    this.authorizationRequired = false;
    return this;
};

RouteMethod.prototype.before = function (beforeFunc) {
    this.beforeFunc = beforeFunc;
    return this;
};

RouteMethod.prototype.after = function (afterFunc) {
    this.afterFunc = afterFunc;
    return this;
};

RouteMethod.prototype.handler = function () {
    return this.handlerFunc;
};

RouteMethod.prototype.getPermission = function () {
    return this.options.resourceName + '.' + this.options.method;
};

RouteMethod.prototype.validate = function(validateFunc) {
  this.validateFunc = validateFunc;
  return this;
};

module.exports = RouteMethod;
