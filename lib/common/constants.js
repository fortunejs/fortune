'use strict'

var hasSymbol = typeof Symbol === 'function'
var i, j, key
var privateKeys = [
  // This is set on the field definition object internally if it is an
  // automatically generated denormalized field.
  'denormalizedInverse',

  // Used to map update objects to records.
  'updateRecord',

  // Used to map update objects to a hash of linked records.
  'linkedHash'
]

// The primary key that must exist per record, can not be user defined.
exports.primary = 'id'

// The names of certain reserved keys per field definition.
exports.type = 'type'
exports.link = 'link'
exports.inverse = 'inverse'
exports.isArray = 'isArray'

// Should be reserved for private use.
for (i = 0, j = privateKeys.length; i < j; i++) {
  key = privateKeys[i]
  exports[key] = hasSymbol ? Symbol(key) : '__' + key + '__'
}

// Events.
exports.change = 'change'
exports.sync = 'sync'
exports.connect = 'connect'
exports.disconnect = 'disconnect'
exports.failure = 'failure'

// Methods.
exports.find = 'find'
exports.create = 'create'
exports.update = 'update'
exports.delete = 'delete'
