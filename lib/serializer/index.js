import defineArguments from '../common/define_arguments'


/**
 * Serializer is an abstract base class containing methods to be implemented.
 * Its methods can be categorized into three main categories: processing,
 * showing (deserializing) or parsing (serializing). Generally, all of its
 * methods should be implemented.
 */
export default class Serializer {

  /**
   * The Serializer should not be instantiated directly, since the constructor
   * function accepts dependencies. The keys which are injected are:
   *
   * - `methods`: same as static property on Fortune class.
   * - `errors`: same as static property on Fortune class.
   * - `keys`: an object which enumerates reserved keys on a record field
   * definition.
   * - `recordTypes`: an object which enumerates record types and their
   * definitions.
   * - `castValue`: a function with the signature (`value`, `type`, `options`),
   * useful for casting arbitrary values to a particular type.
   * - `options`: the options passed to the serializer.
   * - `adapter`: a reference to the adapter instance.
   *
   * These keys are accessible on the instance (`this`).
   */
  constructor () {
    defineArguments(this, ...arguments)
  }


  /**
   * This gets run first. The purpose is typically to read and mutate the
   * request before anything else happens. For example, it can handle URI
   * routing and query string parsing. The arguments that it accepts beyond
   * the required `context` are arbitrary.
   *
   * It should return either the context or a promise that resolves to the
   * context. It is optional to implement.
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
   * over the network. The arguments that it accepts beyond the required
   * `context` may be arbitrary.
   *
   * It should return either the context or a promise that resolves to the
   * context. It is optional to implement.
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
   * @return {Promise|Object}
   */
  showResponse (context) {
    return context
  }


  /**
   * Show error(s). This method should return the `context` object, but
   * mutate the `response`.
   *
   * @param {Object} context
   * @param {Object} error should be an instance of Error
   * @return {Promise|Object}
   */
  showError (context) {
    return context
  }


  /**
   * Parse a request payload for creating records. This method should return
   * an array of records as expected by calling the `adapter.create` method.
   * It may also mutate the context object.
   *
   * @param {Object} context
   * @return {Promise|Object[]}
   */
  parseCreate () {
    return []
  }


  /**
   * Parse a request payload for updating records. This method should return
   * an array of updates as expected by calling the `adapter.update` method.
   * It may also mutate the context object.
   *
   * @param {Object} context
   * @return {Promise|Object[]}
   */
  parseUpdate () {
    return []
  }

}


/**
 * A serializer must have a static property `id`. This should be informative
 * and functional, such as a media type. **MUST** be a primitive type.
 */
Serializer.id = null
