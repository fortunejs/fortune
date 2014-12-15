'use strict';

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
    500: 'Oops, something went wrong.',
    501: 'Feature not implemented.'
};

function JSONProblemError(options) {
    this.name = 'JSONProblemError';
    if (!options) {
        options = {};
    }
    this.problem = {
        httpStatus: options.httpStatus ? options.httpStatus : 500,
        detail: options.detail ? options.detail : '',
        problemType: options.problemType ? options.problemType : 'about:blank',
        title: options.title ? options.title : errorMessages[options.httpStatus]
    };
}
JSONProblemError.prototype = new Error();
JSONProblemError.prototype.constructor = JSONProblemError;

module.exports = JSONProblemError;

