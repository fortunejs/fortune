/**
 * CustomError class which other custom errors subclass from.
 */
export class CustomError extends Error {

  constructor (message) {
    super()

    Error.captureStackTrace(this, this.constructor)

    Object.defineProperty(this, 'message', {
      value: message
    })
  }

  get name () {
    return this.constructor.name
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
