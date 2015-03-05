/**
 * CustomError class which other typed errors subclass from.
 */
class CustomError extends Error {

  constructor (message) {
    Error.captureStackTrace(this, this.constructor);

    Object.defineProperty(this, 'message', {
      value: message
    });
  }

  get name () {
    return this.constructor.name;
  }

}

export class BadRequestError extends CustomError {}
export class UnauthorizedError extends CustomError {}
export class ForbiddenError extends CustomError {}
export class NotFoundError extends CustomError {}
export class MethodError extends CustomError {}
export class NotAcceptableError extends CustomError {}
export class ConflictError extends CustomError {}
export class UnsupportedError extends CustomError {}
