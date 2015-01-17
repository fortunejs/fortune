// Generic error factory.

export default class ErrorFactory extends Error {
  constructor (code, message) {
    this.code = code;
    this.message = message;
  }
}
