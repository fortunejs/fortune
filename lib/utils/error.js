// Generic error factory. This is probably not the way to go, typed errors ftw.

export default class ErrorFactory extends Error {
  constructor (code, message) {
    this.code = code;
    this.message = message;
  }
}
