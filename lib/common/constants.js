'use strict'

// The primary key that must exist per record, can not be user defined.
exports.primary = 'id'

// The names of certain reserved keys per field definition.
exports.type = 'type'
exports.link = 'link'
exports.inverse = 'inverse'
exports.isArray = 'isArray'

// Should be reserved for private use.
exports.denormalizedInverse = '__denormalizedInverse'
exports.internal = '__internal'

// Change event.
exports.change = 'change'

// Methods.
exports.find = 'find'
exports.create = 'create'
exports.update = 'update'
exports.delete = 'delete'
