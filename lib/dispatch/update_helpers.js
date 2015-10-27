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
  cache[type] = {}
  cache[type][id] = true
  return update
}


// Add an ID to an update object.
exports.addId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.push) update.push = Object.create(null)
    if (!update.push[field]) update.push[field] = []
    update.push[field].push(id)
    return
  }

  if (!update.replace) update.replace = Object.create(null)
  update.replace[field] = id
}


// Remove an ID from an update object.
exports.removeId = function (id, update, field, isArray) {
  if (isArray) {
    if (!update.pull) update.pull = Object.create(null)
    if (!update.pull[field]) update.pull[field] = []
    update.pull[field].push(id)
    return
  }

  if (!update.replace) update.replace = Object.create(null)
  update.replace[field] = null
}
