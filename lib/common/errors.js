import errorClass from 'error-class'

export const BadRequestError = errorClass('BadRequestError')
export const UnauthorizedError = errorClass('UnauthorizedError')
export const ForbiddenError = errorClass('ForbiddenError')
export const NotFoundError = errorClass('NotFoundError')
export const MethodError = errorClass('MethodError')
export const NotAcceptableError = errorClass('NotAcceptableError')
export const ConflictError = errorClass('ConflictError')
export const UnsupportedError = errorClass('UnsupportedError')

// White-list native error types.
export const nativeErrors = new Set([
  Error, TypeError, ReferenceError, RangeError,
  SyntaxError, EvalError, URIError
])
