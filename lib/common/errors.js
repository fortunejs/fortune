export class BadRequestError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class UnauthorizedError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class ForbiddenError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class NotFoundError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class MethodError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class NotAcceptableError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class ConflictError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}

export class UnsupportedError extends Error {
  constructor () { super(); setup.apply(this, arguments) }
}


// White-list native error types.
export const nativeErrors = new Set([
  Error, TypeError, ReferenceError, RangeError,
  SyntaxError, EvalError, URIError
])


const hasCaptureStackTrace = 'captureStackTrace' in Error


// Internal function to set up an error.
function setup (message) {
  const { constructor, constructor: { name } } = this

  if (hasCaptureStackTrace)
    Error.captureStackTrace(this, constructor)
  else
    Object.defineProperty(this, 'stack', {
      value: Error().stack
    })

  Object.defineProperties(this, {
    name: { value: name },
    message: { value: message }
  })
}
