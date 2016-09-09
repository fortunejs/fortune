'use strict';

var _ = require('lodash');

var JSONAPI_Error = require('./jsonapi-error');

/**
 * Send a JSONAPI compatible list of errors to the client.
 *
 * @param  {Object} req   standard express req object
 * @param  {Object} res   standard express res object
 * @param  {Array} error  if error is not an array it's automatically promoted
 *                        to an Array. Thus this is backward compatible.
 * @return {undefined}    no return value
 */
var sendError = function (req, res, error) {
    var errorList = [];

    var stringify = function (object) {
        return process.env.NODE_ENV === 'production' ?
            JSON.stringify(object, null, null) :
        JSON.stringify(object, null, 2) + '\n';
    };

    function normaliseError(error) {
        if (error instanceof JSONAPI_Error) {
            return error;
        } else if (error && error.status === 413) {
            return new JSONAPI_Error({
                status: 413,
                detail: error && process.env.NODE_ENV !== 'production' ? error.toString() : ''
            });
        } else {
            return new JSONAPI_Error({
                status: 500,
                detail: error && process.env.NODE_ENV !== 'production' ? error.toString() : ''
            });
        }
    }

    try {

        // promote error if it's not already an Array
        if (!(error instanceof Array)) {
            error = [ error ];
        }

        // handle each error
        _.forEach(error, function A(error) {
            // This function is `A` as it's a "throwaway" (anonymous) function,
            // but anonymous functions make stack traces harder to read. There
            // exists a convention used by some (myself included) to name such
            // "throwaway" functions with a single upper case letter, to make it
            // clear that it's a throw away function.
            // see: https://docs.npmjs.com/misc/coding-style for more info.

            // log error if it's a 500 or strange error
            if (!(error instanceof JSONAPI_Error) || (error instanceof JSONAPI_Error && error.error.status > 500)) {
                console.trace(error && error.stack || error);
            }

            // add normalised error to the list
            errorList.push(normaliseError(error).error);
        });

      // send a list of errors
      res.set('Content-Type', 'application/vnd.api+json');
      // TODO: perhaps find a better heuristic for calculating the "global" error status of this response.
      res.status(errorList[0].status).send(stringify({ errors: errorList }));

    } catch (e) {
        console.error('! Something broke during sendError routine !', e.stack);
    }

};

module.exports = sendError;


