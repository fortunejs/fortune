'use strict';

var _ = require('lodash');

var JSONAPI_Error = require('./jsonapi-error');

var sendError = function (req, res, error) {

    var stringify = function (object) {
        return process.env.NODE_ENV === 'production' ?
            JSON.stringify(object, null, null) :
        JSON.stringify(object, null, 2) + '\n';
    };

    function normaliseError(error) {
        if (error instanceof JSONAPI_Error) {
            return error;
        } else {
            return new JSONAPI_Error({
                status: 500,
                detail: error && process.env.NODE_ENV !== 'production' ? error.toString() : ''
            });
        }
    }

    try {

        /** todo handle possibility of array of errors in case of a bulk insert
         * right now the promise chain of createResources fails on the first error
         * the use of https://github.com/tildeio/rsvp.js/#all-settled-and-hash-settled can improve this
         * and return back errors for all rejected items
         * */

        if (!(error instanceof JSONAPI_Error) || (error instanceof JSONAPI_Error && error.error.status > 500))
            console.trace(error);

        res.set('Content-Type', 'application/vnd.api+json');
        var normalisedFirstError = normaliseError(error);
        res.send(normalisedFirstError.error.status, stringify({errors: [normalisedFirstError.error]}));

    } catch (e) {
        console.error('! Something broke during sendError routine !', e.stack);
    }

};

module.exports = sendError;


