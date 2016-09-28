'use strict'

var responseClass = require('../common/response_classes')

module.exports = new WeakMap([
  [ Error, 500 ],
  [ responseClass.UnsupportedError, 415 ],
  [ responseClass.ConflictError, 409 ],
  [ responseClass.NotAcceptableError, 406 ],
  [ responseClass.MethodError, 405 ],
  [ responseClass.NotFoundError, 404 ],
  [ responseClass.ForbiddenError, 403 ],
  [ responseClass.UnauthorizedError, 401 ],
  [ responseClass.BadRequestError, 400 ],
  [ responseClass.Empty, 204 ],
  [ responseClass.Created, 201 ],
  [ responseClass.OK, 200 ]
])
