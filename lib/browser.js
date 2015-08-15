// Local modules.
import Fortune from './core'
import defineArguments from './common/define_arguments'

// Static exports.
import memory from './adapter/adapters/memory'
import indexedDB from './adapter/adapters/indexeddb'
import webStorage from './adapter/adapters/webstorage'


const adapters = { memory, indexedDB, webStorage }

// Assign useful static properties to the default export.
defineArguments(Fortune, { adapters })

export default Fortune
