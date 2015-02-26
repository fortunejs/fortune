import * as Errors from '../common/errors';


// Map strings and errors to HTTP status codes.
export default new Map()
  .set('success', 200)
  .set('created', 201)
  .set('empty', 204)
  .set('notModified', 304)
  .set(Errors.BadRequestError, 400)
  .set(Errors.UnauthorizedError, 401)
  .set(Errors.ForbiddenError, 403)
  .set(Errors.NotFoundError, 404)
  .set(Errors.MethodError, 405)
  .set(Errors.NotAcceptableError, 406)
  .set(Errors.ConflictError, 409)
  .set(Errors.UnsupportedError, 415)
  .set('error', 500);
