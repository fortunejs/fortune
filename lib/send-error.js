'use strict';

// todo handle array of errors in sendError
var sendError = function (req, res, error) {

    var stringify = function (object) {
        return process.env.NODE_ENV === 'production' ?
            JSON.stringify(object, null, null) :
        JSON.stringify(object, null, 2) + '\n';
    };

    function normaliseError(error) {
        if (error && error.problem) {
            return error;
        } else {
            var unexpectedError = new Error();
            unexpectedError.problem = {
                httpStatus: 500,
                problemType: 'about:blank',
                title: 'Oops, something went wrong.',
                detail: error ? error.toString() : ''
            };
            return unexpectedError;
        }
    }

    try {
        if (!!error && error.problem && error.problem.httpStatus >= 500) console.trace(error);
        res.set('Content-Type', 'application/problem+json');
        var normalisedError = normaliseError(error);
        res.send(normalisedError.problem.httpStatus, stringify(normalisedError));
    } catch (e) {
        console.error('! Something broke during sendError routine !', e.stack);
    }

};

module.exports = sendError;


