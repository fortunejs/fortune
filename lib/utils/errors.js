// TypedError class which other typed errors subclass from.
class TypedError extends Error {

  constructor (message) {
    Object.defineProperty(this, 'message', {
      value: message
    });
  }

  get name () {
    return this.constructor.name;
  }

}

export class NotFoundError extends TypedError {}
export class MethodError extends TypedError {}
export class NotAcceptableError extends TypedError {}
export class UnsupportedError extends TypedError {}
