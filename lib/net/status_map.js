import errors from '../common/errors';


// Map strings and errors to HTTP status codes.
export default new Map([
  ['success', 200],
  ['created', 201],
  ['empty', 204],
  ['notModified', 304],
  [errors.BadRequestError, 400],
  [errors.UnauthorizedError, 401],
  [errors.ForbiddenError, 403],
  [errors.NotFoundError, 404],
  [errors.MethodError, 405],
  [errors.NotAcceptableError, 406],
  [errors.ConflictError, 409],
  [errors.UnsupportedError, 415],
  ['error', 500]
]);
