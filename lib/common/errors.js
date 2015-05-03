export class BadRequestError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class UnauthorizedError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class ForbiddenError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class NotFoundError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class MethodError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class NotAcceptableError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class ConflictError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}

export class UnsupportedError extends Error {
  constructor () { super(); setup.call(this, ...arguments) }
}


/**
 * Internal function to set up an error.
 */
function setup (message) {
  const { name } = this.constructor

  if ('captureStackTrace' in Error)
    Error.captureStackTrace(this, this.constructor)
  else
    Object.defineProperty(this, 'stack', {
      value: new Error().stack
    })

  Object.defineProperties(this, {
    name: { value: name },
    message: { value: message }
  })
}
