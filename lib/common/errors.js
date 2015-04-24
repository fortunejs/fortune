export class BadRequestError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class UnauthorizedError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class ForbiddenError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class NotFoundError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class MethodError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class NotAcceptableError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class ConflictError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}

export class UnsupportedError extends Error {
  constructor () {
    super()
    setupError.call(this, this.constructor.name, ...arguments)
  }
}


/**
 * Internal function to set up an error.
 */
function setupError (name, message) {
  if ('captureStackTrace' in Error)
    Error.captureStackTrace(this, this.constructor)
  else
    Object.defineProperty(this, 'stack', {
      value: (new Error()).stack
    })

  Object.defineProperties(this, {
    name: { value: name },
    message: { value: message }
  })
}
