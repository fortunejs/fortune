/**
 * Serializer is a class containing methods to be implemented. Serializer
 * methods can be categorized into three main categories: processing,
 * showing (deserializing) or parsing (serializing). Generally, all of its
 * methods should be implemented.
 */
export default class Serializer {

  constructor () {
    Object.assign(this, ...arguments)
  }


  /**
   * This gets run first. The purpose is typically to read and mutate
   * the request before anything else happens. For example, it can handle
   * URI routing and query string parsing. The arguments that it accepts
   * beyond the required `context` are arbitrary. It is optional to implement.
   * It should return either the context or a promise that resolves to the
   * context. Note that it is not guaranteed that a request will have the same
   * serializer for the response.
   *
   * @param {Object} context
   * @param {...*} [args]
   * @return {Promise|Object}
   */
  processRequest (context) {
    return context
  }


  /**
   * This gets run last. The purpose is typically to read and mutate
   * the response at the very end, for example, stringifying an object
   * to be sent over the wire. The arguments that it accepts beyond
   * the required `context` are arbitrary. It is optional to implement.
   * It should return either the context or a promise that resolves to the
   * context. Note that it is not guaranteed that a request will have the same
   * serializer for the response.
   *
   * @param {Object} context
   * @param {...*} [args]
   * @return {Promise|Object}
   */
  processResponse (context) {
    return context
  }


  /**
   * Show the top-level index, typically a list of links. It should return
   * the `context` object, but mutate the `response`.
   *
   * @param {Object} context
   * @return {Object}
   */
  showIndex (context) {
    context.response.payload = Object.keys(this.schemas)

    return context
  }


  /**
   * Render records in the response. The parameter `records` is an array
   * of records. The parameter `include` is a hash that must follow this
   * format:
   *
   * ```js
   * {
   *   // An object keyed by type, valued by arrays of records.
   *   [type]: [ ... ]
   * }
   * ```
   *
   * This method should return the `context` object, but mutate the
   * `response`.
   *
   * @param {Object} context
   * @param {Object[]} records
   * @param {Object} [include]
   * @return {Object}
   */
  showResponse (context, records, include) {
    const output = { records }

    if (include) output.include = include
    context.response.payload = output

    return context
  }


  /**
   * Show error(s). This method should return the `context` object, but
   * mutate the `response`.
   *
   * @param {Object} context
   * @param {Object} error should be an instance of Error
   * @return {Object}
   */
  showError (context, error) {
    context.response.payload = error.name +
      (error.message ? `: ${error.message}` : '')

    return context
  }


  /**
   * Parse a request payload for creating records. This method should return
   * an array of records as expected by calling the `adapter.create` method.
   * It should not mutate the context object.
   *
   * @param {Object} context
   * @return {Object[]}
   */
  parseCreate (context) {
    return context.request.payload
  }


  /**
   * Parse a request payload for updating records. This method should return
   * an array of updates as expected by calling the `adapter.update` method.
   * It should not mutate the context object.
   *
   * @param {Object} context
   * @return {Object[]}
   */
  parseUpdate (context) {
    return context.request.payload
  }

}


/**
 * A serializer must have a static property `id`. This should be informative
 * and functional, such as a media type.
 */
Serializer.id = undefined
