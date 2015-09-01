import { primary as primaryKey } from '../common/keys'
import { find } from '../common/array_proxy'


// Get a related update object by ID, or return a new one if not found.
export function getUpdate (type, id, updates, cache) {
  if (cache[type].has(id))
    return find(updates[type],
      update => update[primaryKey] === id)

  const update = { id }
  updates[type].push(update)
  cache[type].add(id)
  return update
}


// Add an ID to an update object.
export function addId (id, update, field, isArray) {
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
export function removeId (id, update, field, isArray) {
  if (isArray) {
    if (!update.pull) update.pull = {}
    if (!update.pull[field]) update.pull[field] = []
    update.pull[field].push(id)
    return
  }

  if (!update.replace) update.replace = {}
  update.replace[field] = null
}
