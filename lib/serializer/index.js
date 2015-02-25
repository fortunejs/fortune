/**
 * Serializer is a class containing methods to be implemented. All of its
 * methods **must** be synchronous, no promises or callbacks, it has to
 * be fast/blocking. Serializer methods can be categorized into two main
 * categories: showing (deserializing) or parsing (serializing). Generally
 * all of its methods should be implemented, except for certain formats
 * which may be read-only, such as JSON Patch. All of the methods take the
 * `context` object as the first parameter.
 */
export default class Serializer {

  constructor () {
    Object.assign(this, ...arguments);
  }


  /**
   * This gets run first. The purpose is typically to read and mutate
   * the request before anything else happens. For example, it can handle
   * URI routing and query string parsing. The arguments that it accepts
   * beyond the required `context` are arbitrary. It is optional to implement.
   *
   * @param {Object} context
   * @param {*} [args]
   * @return {Object}
   */
  processRequest (context) {
    return context;
  }


  /**
   * This gets run last. The purpose is typically to read and mutate
   * the response at the very end, for example, stringifying an object
   * to be sent over the wire. The arguments that it accepts beyond
   * the required `context` are arbitrary. It is optional to implement.
   *
   * @param {Object} context
   * @param {*} [args]
   * @return {Object}
   */
  processResponse (context) {
    return context;
  }


  /**
   * Show the top-level index, typically a list of links. It should return
   * the `context` object, but mutate the `response`.
   *
   * @param {Object} context
   * @return {Object}
   */
  showIndex (context) {
    return context;
  }


  /**
   * Represent an entity or entities as a resource. The parameter `entities`
   * must follow this format:
   *
   * ```js
   * {
   *   type: [{}, ...]
   * }
   * ```
   *
   * It is keyed by type, and its value is an array of objects. It should
   * return the `context` object, but mutate the `response`.
   *
   * @param {Object} context
   * @param {Array} entities
   * @param {Object} [include]
   * @return {Object}
   */
  showResource (context) {
    return context;
  }


  /**
   * Show error(s). This method should return the `context` object, but
   * mutate the `response`.
   * @param {Object} context
   * @param {Object} error should inherit from Error object.
   */
  showError (context, error) {
    context.response.payload =
      `${error.name}${!!error.message ? ': ' + error.message : ''}`;

    return context;
  }


  /**
   * Parse a request payload for creating entities. This method should return
   * an array of entities as expected by calling the `adapter.create` method.
   * It should not mutate the context object.
   *
   * @param {Object} context
   * @return {Array}
   */
  parseCreate () {
    return [];
  }


  /**
   * Parse a request payload for updating entities. This method should return
   * an array of updates as expected by calling the `adapter.update` method.
   * It should not mutate the context object.
   *
   * @param {Object} context
   * @return {Array}
   */
  parseUpdate () {
    return [];
  }

}
