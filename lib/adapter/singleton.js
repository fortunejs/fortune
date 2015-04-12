import Adapter from './'


/**
 * A singleton for the adapter. For internal use.
 */
export default class AdapterSingleton extends Adapter {

  constructor (core) {
    super()

    let { type } = core.options.adapter

    if (typeof type !== 'function')
      throw new Error(`The "type" must be a function.`)

    if (Object.getOwnPropertyNames(type.prototype).length === 1)
      type = type(Adapter)

    if (Object.getPrototypeOf(type) !== Adapter)
      throw new Error(`The "type" must be a class ` +
        `that extends Adapter.`)

    const CustomAdapter = type

    return new CustomAdapter({
      options: core.options.adapter.options || {},
      schemas: core.schemas
    })
  }

}
