'use strict'

var responseClass = require('./response_classes')

exports.BadRequestError = responseClass.BadRequestError
exports.UnauthorizedError = responseClass.UnauthorizedError
exports.ForbiddenError = responseClass.ForbiddenError
exports.NotFoundError = responseClass.NotFoundError
exports.MethodError = responseClass.MethodError
exports.NotAcceptableError = responseClass.NotAcceptableError
exports.ConflictError = responseClass.ConflictError
exports.UnsupportedError = responseClass.UnsupportedError
exports.UnprocessableError = responseClass.UnprocessableError
exports.nativeErrors = responseClass.nativeErrors
