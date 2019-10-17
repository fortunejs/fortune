'use strict'

var find = require('../common/array/find')

var keys = require('../common/keys')
var primaryKey = keys.primary


// Get a related update object by ID, or return a new one if not found.
exports.getUpdate = function (type, id, updates, cache) {
  var update

  if (cache[type] && cache[type][id])
    return find(updates[type],
      function (update) {
        return update[primaryKey] === id
      })

  update = { id: id }
  if (!updates[type]) updates[type] = []
  updates[type].push(update)
  if (!cache[type]) cache[type] = {}
  cache[type][id] = true
  return update
}


// Add an ID to an update object.
exports.addId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.push) update.push = {}
    if (!update.push[field]) update.push[field] = []
    update.push[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = id
}


// Remove an ID from an update object.
exports.removeId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.pull) update.pull = {}
    if (!update.pull[field]) update.pull[field] = []
    update.pull[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = null
}


// Remove denormalized fields from appearing in updates on change events.
exports.scrubDenormalizedUpdates = function (updates, denormalizedFields) {
  var i, update, operation, field

  // Iterate in reverse, so we can easily remove indices in the array.
  for (i = updates.length; i--;) {
    update = updates[i]

    for (operation in update) {
      if (operation === primaryKey) continue

      for (field in update[operation])
        if (field in denormalizedFields)
          delete update[operation][field]

      if (!Object.keys(update[operation]).length)
        delete update[operation]
    }

    // If only the primary key is present, then remove the entire update.
    if (Object.keys(update).length === 1) updates.splice(i, 1)
  }
}
