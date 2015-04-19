/**
 * CustomError class which other custom errors subclass from.
 */
export class CustomError extends Error {

  constructor (message) {
    super()

    if ('captureStackTrace' in Error)
      Error.captureStackTrace(this, this.constructor)
    else
      Object.defineProperty(this, 'stack', {
        value: (new Error()).stack
      })

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
