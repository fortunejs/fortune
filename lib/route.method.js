var _ = require('lodash');

var SSE = require('./sse');
var JSONAPI_Error = require('./jsonapi-error.js');
var sendError = require('./send-error');

function methodNotAllowedFunc(req, res) {
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
            var methodNotAllowed = (methodNotAllowedFunc === routeMethod.handlerFunc);
            var authorizationEnabled = (routeMethod.authorizationRequired !== false);
            var authorizationStrategyPresent = (authorizationStrategy instanceof Function);
            return authorizationEnabled && !methodNotAllowed && authorizationStrategyPresent;
        }

        /**
         * This function is meant to be invoked in promise chain, which means that any exception thrown by callRouteHandler will not get out of routeInterceptor
         * (will be swallowed), so we need to close the connection with proper error sent to client.
         */
        function safelyCallRouteHandler(authResult) {
            if (authResult instanceof Error) return sendError(request, response, authResult);
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
                authorizationResult.then(safelyCallRouteHandler).catch(function (result) {
                    var err = new JSONAPI_Error({status: 403});
                    if (result instanceof JSONAPI_Error) err = result;
                    sendError(request, response, err);
                });
            } else {
                /*if the result is not a promise*/
                sendError(request, response, authorizationResult);
            }
        }

        if (isAuthorizationRequired()) {
            var rolesAllowed = _.isEmpty(routeMethod.roles) ? routeMethod.options.resource.roles : routeMethod.roles;
            var authorizationResult = authorizationStrategy(request, routeMethod.getPermissionName(), rolesAllowed || []);
            handleAuthorizationResult(authorizationResult);
        } else {
            callRouteHandler();
        }
    };
}

function RouteMethod(options) {
    if (options.harvester == null) {
        throw new Error('Options must include reference to harvester (property harvester)');
    }
    if (options.resource == null) {
        throw new Error('Options must include resource (property resource)');
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
        
        new SSE().init({
            context: this.options.harvester,
            singleResourceName: this.options.resource.name,
            verbs: ['post', 'put', 'delete']
        });
        return this;
    }

    if (this.options.notAllowed) {
        this.handlerFunc = methodNotAllowedFunc;
        this.options.harvester.router[method](route, methodNotAllowedFunc);
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

RouteMethod.prototype.getPermissionName = function () {
    return this.options.resource.name + '.' + (this.options.permissionSuffix || this.options.method);
};

RouteMethod.prototype.validate = function (validateFunc) {
    this.validateFunc = validateFunc;
    return this;
};

RouteMethod.prototype.notAllowed = function () {
    this.options.notAllowed = true;
    return this;
};

RouteMethod.prototype.isAllowed = function () {
    return this.handlerFunc !== methodNotAllowedFunc;
};

RouteMethod.prototype.roles = function () {
    this.roles = Array.prototype.slice.call(arguments);
    return this;
};

module.exports = RouteMethod;
