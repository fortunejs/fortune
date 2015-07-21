import Adapter from './'
import * as keys from '../common/keys'
import * as errors from '../common/errors'


/**
 * A singleton for the adapter. For internal use.
 */
export default class AdapterSingleton extends Adapter {

  constructor (dependencies) {
    super()

    const { recordTypes } = dependencies
    let { type } = dependencies.adapter

    if (typeof type !== 'function')
      throw new TypeError(`The adapter must be a function or class.`)

    // Check if it's a class or a dependency injection function.
    try { type = type(Adapter) }
    catch (error) { if (!(error instanceof TypeError)) throw error }

    const CustomAdapter = type

    let prototype = Object.getPrototypeOf(CustomAdapter)
    let isSubclass = false
    while (prototype !== null) {
      prototype = Object.getPrototypeOf(prototype)
      if (prototype === Adapter) {
        isSubclass = true
        break
      }
    }

    if (!isSubclass)
      throw new TypeError(`The adapter must be a class ` +
        `that extends Adapter.`)

    return new CustomAdapter({
      options: dependencies.adapter.options || {},
      keys, errors, recordTypes
    })
  }

}
