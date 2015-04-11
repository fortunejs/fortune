/**
 * CustomError class which other typed errors subclass from.
 */
class CustomError extends Error {

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

class BadRequestError extends CustomError {}
class UnauthorizedError extends CustomError {}
class ForbiddenError extends CustomError {}
class NotFoundError extends CustomError {}
class MethodError extends CustomError {}
class NotAcceptableError extends CustomError {}
class ConflictError extends CustomError {}
class UnsupportedError extends CustomError {}


export default {
  BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
  MethodError, NotAcceptableError, ConflictError, UnsupportedError
}
