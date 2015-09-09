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

    const CustomAdapter = Adapter.prototype
      .isPrototypeOf(type.prototype) ? type : type(Adapter)

    if (!Adapter.prototype.isPrototypeOf(CustomAdapter.prototype))
      throw new TypeError(`The adapter must be a class that extends ` +
        `Adapter.`)

    return new CustomAdapter({
      options: dependencies.adapter.options || {},
      keys, errors, recordTypes
    })
  }

}
