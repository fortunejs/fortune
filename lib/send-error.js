'use strict';

var JSONProblemError = require('./json-problem-error');

// todo handle array of errors in sendError
var sendError = function (req, res, error) {

    var stringify = function (object) {
        return process.env.NODE_ENV === 'production' ?
            JSON.stringify(object, null, null) :
        JSON.stringify(object, null, 2) + '\n';
    };

    function normaliseError(error) {
        if (error instanceof JSONProblemError) {
            return error;
        } else {
            return new JSONProblemError({
                httpStatus: 500,
                detail: error && process.env.NODE_ENV !== 'production' ? error.toString() : ''
            });
        }
    }

    try {
        if (!(error instanceof JSONProblemError) || (error instanceof JSONProblemError && error.problem.httpStatus>500)) console.trace(error);
        res.set('Content-Type', 'application/problem+json');
        var normalisedError = normaliseError(error);
        res.send(normalisedError.problem.httpStatus, stringify(normalisedError));
    } catch (e) {
        console.error('! Something broke during sendError routine !', e.stack);
    }

};

module.exports = sendError;


