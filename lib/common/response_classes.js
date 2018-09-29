'use strict'

var errorClass = require('error-class')
var assign = require('./assign')


// Successes.
exports.OK = function OK (hash) { assign(this, hash) }
exports.Created = function Created (hash) { assign(this, hash) }
exports.Empty = function Empty (hash) { assign(this, hash) }


// Errors.
exports.BadRequestError = errorClass('BadRequestError')
exports.UnauthorizedError = errorClass('UnauthorizedError')
exports.ForbiddenError = errorClass('ForbiddenError')
exports.NotFoundError = errorClass('NotFoundError')
exports.MethodError = errorClass('MethodError')
exports.NotAcceptableError = errorClass('NotAcceptableError')
exports.ConflictError = errorClass('ConflictError')
exports.UnsupportedError = errorClass('UnsupportedError')
exports.UnprocessableError = errorClass('UnprocessableError')


// White-list native error types. The list is gathered from here:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/
// Reference/Global_Objects/Error
exports.nativeErrors = [
  Error, TypeError, ReferenceError, RangeError,
  SyntaxError, EvalError, URIError
]
