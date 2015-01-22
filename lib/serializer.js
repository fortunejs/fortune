import {empty as noop} from './utils/noop';


/**
 * Serializer is a class containing methods to be implemented. All of its
 * methods **must** be synchronous, no promises or callbacks, it has to
 * be fast/blocking. Serializer methods can be categorized into two main
 * categories: showing (deserializing) or parsing (serializing). Generally
 * all of its methods should be implemented, except for certain formats
 * which may be read-only, such as JSON Patch. All of the methods take
 * the `context` object as the first parameter.
 */
export default class Serializer {

  constructor (context) {
    Object.assign(this, context);
  }

  /**
   * Show the top-level index, typically a list of links. It does not need
   * to return anything, only mutate `context.response`.
   *
   * @param {Object} context
   */
  showIndex () {
    return noop();
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
   * It is keyed by type, and its value is an array of objects. It does
   * not need to return anything, only mutate `context.response`.
   *
   * @param {Object} context
   * @param {Object} entities
   */
  showResource () {
    return noop();
  }

  /**
   * Show error(s). This method should mutate the state of the context
   * and it does not need to return anything, but should mutate
   * `context.response`.
   *
   * @param {Object} context
   * @param {Object|Array} errors should be of Error class.
   */
  showError () {
    return noop();
  }

  /**
   * Parse a request payload for creating entities. This method should return
   * an array of entities as expected by calling the `adapter.create` method.
   *
   * @param {Object} context
   * @return {Array}
   */
  parseCreate () {
    return noop([]);
  }

  /**
   * Parse a request payload for creating entities. This method should return
   * an array of updates as expected by calling the `adapter.update` method.
   *
   * @param {Object} context
   * @return {Array}
   */
  parseUpdate () {
    return noop([]);
  }

}
