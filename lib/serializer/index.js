import defineArguments from '../common/define_arguments'


/**
 * Serializer is a class containing methods to be implemented. Serializer
 * methods can be categorized into three main categories: processing,
 * showing (deserializing) or parsing (serializing). Generally, all of its
 * methods should be implemented.
 */
export default class Serializer {

  constructor () {
    defineArguments.apply(this, arguments)
  }


  /**
   * This gets run first. The purpose is typically to read and mutate the
   * request before anything else happens. For example, it can handle URI
   * routing and query string parsing. The arguments that it accepts beyond
   * the required `context` are arbitrary.
   *
   * It should return either the context or a promise that resolves to the
   * context. Note that it is not guaranteed that a request will have the same
   * serializer for the response. It is optional to implement.
   *
   * @param {Object} context
   * @param {...*} [args]
   * @return {Promise|Object}
   */
  processRequest (context) {
    return context
  }


  /**
   * This gets run last. The purpose is typically to read and mutate the
   * response at the very end, for example, stringifying an object to be sent
   * over the wire. The arguments that it accepts beyond the required `context`
   * are arbitrary.
   *
   * It should return either the context or a promise that resolves to the
   * context. Note that it is not guaranteed that a request will have the same
   * serializer for the response. It is optional to implement.
   *
   * @param {Object} context
   * @param {...*} [args]
   * @return {Promise|Object}
   */
  processResponse (context) {
    return context
  }


  /**
   * Render the response. The parameter `records` is an array of records. The
   * parameter `include` is a hash that must follow this format:
   *
   * ```js
   * {
   *   // An object keyed by type, valued by arrays of records.
   *   [type]: [ ... ]
   * }
   * ```
   *
   * If `records` is missing, then it is assumed that the index route must be
   * shown.
   *
   * This method should return the `context` object, but mutate the
   * `response`.
   *
   * @param {Object} context
   * @param {Object[]} [records]
   * @param {Object} [include]
   * @return {Object}
   */
  showResponse (context, records, include) {
    const { response } = context

    if (!records) {
      response.payload = Object.keys(this.schemas)
      return context
    }

    const output = { records }

    if (include) output.include = include
    response.payload = output

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
    const { response } = context
    const { stack } = error

    response.payload = stack ? stack.toString() : error.toString()

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
    const { errors } = this
    const { ids } = context.request
    const records = context.request.payload

    if (ids)
      throw new errors.BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(records) || !records.length)
      throw new errors.BadRequestError(`Records are unspecified.`)

    return records
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
    const { errors } = this
    const { ids } = context.request
    const updates = context.request.payload

    if (ids)
      throw new errors.BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(updates) || !updates.length)
      throw new errors.BadRequestError(`Updates are unspecified.`)

    return updates
  }

}


/**
 * A serializer must have a static property `id`. This should be informative
 * and functional, such as a media type.
 */
Serializer.id = null
