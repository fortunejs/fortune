import * as errors from '../common/errors'
import * as success from '../common/success'


// Map successes and errors to HTTP status codes.
export default new WeakMap([
  [ success.OK, 200 ],
  [ success.Created, 201 ],
  [ success.Empty, 204 ],
  [ errors.BadRequestError, 400 ],
  [ errors.UnauthorizedError, 401 ],
  [ errors.ForbiddenError, 403 ],
  [ errors.NotFoundError, 404 ],
  [ errors.MethodError, 405 ],
  [ errors.NotAcceptableError, 406 ],
  [ errors.ConflictError, 409 ],
  [ errors.UnsupportedError, 415 ],
  [ Error, 500 ]
])
