import * as errors from '../common/errors';


// Map strings and errors to HTTP status codes.
export default new Map()
  .set('success', 200)
  .set('created', 201)
  .set('empty', 204)
  .set('notModified', 304)
  .set(errors.BadRequestError, 400)
  .set(errors.UnauthorizedError, 401)
  .set(errors.ForbiddenError, 403)
  .set(errors.NotFoundError, 404)
  .set(errors.MethodError, 405)
  .set(errors.NotAcceptableError, 406)
  .set(errors.ConflictError, 409)
  .set(errors.UnsupportedError, 415)
  .set('error', 500);
