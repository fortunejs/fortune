// Local modules.
import FortuneCore from './core'
import defineArguments from './common/define_arguments'
import getGlobalObject from './common/global_object'

// Static exports.
import memory from './adapter/adapters/memory'
import indexedDB from './adapter/adapters/indexeddb'
import webStorage from './adapter/adapters/webstorage'


const adapters = { memory, indexedDB, webStorage }
const globalObject = getGlobalObject()
const hasIndexedDB = 'indexedDB' in globalObject
const hasWebStorage = 'localStorage' in globalObject


/**
 * This class just extends FortuneCore with some default serializers and static
 * properties.
 */
export default class Fortune extends FortuneCore {

  constructor (options = {}) {
    // Try to use in order of priority: IndexedDB, WebStorage, memory adapter.
    if (!('adapter' in options))
      if (hasIndexedDB) options.adapter = { type: indexedDB }
      else if (hasWebStorage) options.adapter = { type: webStorage }

    if (!('enforceLinks' in options))
      options.enforceLinks = false

    super(options)
  }

  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
defineArguments(Fortune, { adapters })
