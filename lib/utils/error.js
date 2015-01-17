// Generic error types, corresponding to HTTP status codes.

// 400 range
export class RequestError extends Error {}               // 400
export class UnauthorizedError extends Error {}          // 401
export class ForbiddenError extends Error {}             // 403
export class NotFoundError extends Error {}              // 404
export class MethodError extends Error {}                // 405
export class NotAcceptableError extends Error {}         // 406
export class PreconditionError extends Error {}          // 412
export class UnsupportedError extends Error {}           // 415
export class TooManyError extends Error {}               // 429

// 500 range
export class InternalError extends Error {}              // 500
