'use strict';

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

var jsonProblemError = function (status, detail, title, problemType) {
    return new Error({
        problem: {
            httpStatus: status,
            detail: (!!detail) ? detail : '',
            problemType: (!!problemType) ? problemType : 'about:blank',
            title: (!!title) ? title : errorMessages[status]
        }
    });
};

module.exports = jsonProblemError;