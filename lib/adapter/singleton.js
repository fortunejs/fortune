import Adapter from './'


/**
 * A singleton for the adapter. For internal use.
 */
export default class AdapterSingleton extends Adapter {

  constructor (core) {
    super()

    let { type } = core.options.adapter

    if (typeof type !== 'function')
      throw new TypeError(`The adapter must be a function or class.`)

    // Duck type checking if it's a class or not based on prototype.
    if (Object.getOwnPropertyNames(type.prototype).length === 1)
      type = type(Adapter)

    const CustomAdapter = type

    if (Object.getPrototypeOf(CustomAdapter) !== Adapter)
      throw new TypeError(`The adapter must be a class ` +
        `that extends Adapter.`)

    return new CustomAdapter({
      options: core.options.adapter.options || {},
      schemas: core.schemas
    })
  }

}
