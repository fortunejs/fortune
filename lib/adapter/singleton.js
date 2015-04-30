import Adapter from './'
import * as keys from '../common/reserved_keys'
import * as errors from '../common/errors'


/**
 * A singleton for the adapter. For internal use.
 */
export default class AdapterSingleton extends Adapter {

  constructor (core) {
    super()

    let CustomAdapter
    const { type, options } = core.options.adapter
    const { schemas } = core

    if (typeof type !== 'function')
      throw new TypeError(`The adapter must be a function or class.`)

    CustomAdapter = type

    // Check if it's a class or a dependency injection function.
    try { CustomAdapter = CustomAdapter(Adapter) }
    catch (error) { if (!(error instanceof TypeError)) throw error }

    if (Object.getPrototypeOf(CustomAdapter) !== Adapter)
      throw new TypeError(`The adapter must be a class ` +
        `that extends Adapter.`)

    return new CustomAdapter({ keys, errors, options, schemas })
  }

}
