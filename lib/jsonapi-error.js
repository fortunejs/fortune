'use strict';

var _ = require('lodash');

// constants
var MIME = {
    standard: ['application/vnd.api+json', 'application/json'],
    patch: ['application/json-patch+json']
};

var errorMessages = {
    400: 'Request was malformed.',
    403: 'Access forbidden.',
    404: 'Resource not found.',
    405: 'Method not permitted.',
    412: 'Request header "Content-Type" must be one of: ' + MIME.standard.join(', '),
    422: 'Unprocessable Entity.',
    500: 'Oops, something went wrong.',
    501: 'Feature not implemented.'
};

function JSONAPI_Error(error) {
    this.name = 'JSONAPI_Error';
    if (!error) {
        error = {};
    }

    var status = error.status ? error.status : 500;

    var errorWithDefaults = _.merge({}, error, {
        status: status,
        href: error.href ? error.href : 'about:blank',
        title: error.title ? error.title : errorMessages[status],
        detail: error.detail ? error.detail : ''
    });

    this.error = errorWithDefaults;
}
JSONAPI_Error.prototype = new Error();
JSONAPI_Error.prototype.constructor = JSONAPI_Error;

module.exports = JSONAPI_Error;

