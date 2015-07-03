// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'
import getGlobalObject from './common/global_object'

// Static exports.
import IndexedDB from './adapter/adapters/indexeddb'
import WebStorage from './adapter/adapters/webstorage'


const adapters = { IndexedDB, WebStorage }
const hasIndexedDB = 'indexedDB' in getGlobalObject()


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
    if (typeof options !== 'object')
      throw new TypeError(`Argument "options" must be an object.`)

    if (!('adapter' in options))
      options.adapter = { type: hasIndexedDB ? IndexedDB : WebStorage }

    super(options)
  }

  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
defineArguments(Fortune, { adapters })
