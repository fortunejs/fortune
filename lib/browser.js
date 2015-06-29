// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'

// Static exports.
import indexeddb from './adapter/adapters/indexeddb'


const adapters = { indexeddb }


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
    if (typeof options !== 'object')
      throw new TypeError(`Argument "options" must be an object.`)

    if (!('adapter' in options))
      options.adapter = { type: adapters.indexeddb }

    super(options)
  }

  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
defineArguments(Fortune, { adapters })
