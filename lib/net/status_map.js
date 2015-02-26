import * as Errors from '../common/errors';


// Map strings and errors to HTTP status codes.
const statusMap = new Map();

statusMap.set('success', 200);
statusMap.set('created', 201);
statusMap.set('empty', 204);
statusMap.set('notModified', 304);
statusMap.set(Errors.BadRequestError, 400);
statusMap.set(Errors.UnauthorizedError, 401);
statusMap.set(Errors.ForbiddenError, 403);
statusMap.set(Errors.NotFoundError, 404);
statusMap.set(Errors.MethodError, 405);
statusMap.set(Errors.NotAcceptableError, 406);
statusMap.set(Errors.ConflictError, 409);
statusMap.set(Errors.UnsupportedError, 415);
statusMap.set('error', 500);

export default statusMap;
