import Adapter from './'
import * as errors from '../common/errors'

var constants = require('../common/constants')


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
      keys: {
        primary: constants.primary,
        link: constants.link,
        isArray: constants.isArray,
        inverse: constants.inverse,
        denormalizedInverse: constants.denormalizedInverse
      }, errors, recordTypes
    })
  }

}
