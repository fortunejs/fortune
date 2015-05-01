/**
 * Given a schema, record, and an update object, apply the update on a cloned
 * record. Note that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} schema
 * @param {Object} update
 * @return {Object}
 */
export default function applyUpdate (record, schema, update) {
  const clone = Object.assign({}, record)

  for (let key in update.set) {
    if (!(key in schema)) continue
    clone[key] = update.set[key]
  }

  for (let key in update.push) {
    if (!(key in schema)) continue
    if (Array.isArray(update.push[key]))
      clone[key].slice().push(...update.push[key])
    else clone[key].slice().push(update.push[key])
  }

  for (let key in update.pull) {
    if (!(key in schema)) continue
    clone[key] = clone[key].filter(
      exclude.bind(null, Array.isArray(update.pull[key])) ?
      update.pull[key] : [update.pull[key]])
  }

  return clone
}


function exclude (values, value) {
  return !~values.indexOf(value)
}
