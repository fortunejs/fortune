/**
 * Given a schema, record, and an update object, apply the update on the
 * record. The informal order of operations is: set, unset, push, pull. Note
 * that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} schema
 * @param {Object} update
 * @return {Object}
 */
export default function applyUpdate (record, schema, update) {
  for (let key in update.set) {
    if (!(key in schema)) continue
    record[key] = update.set[key]
  }

  for (let key in update.unset) {
    if (!(key in schema)) continue
    record[key] = null
  }

  for (let key in update.push) {
    if (!(key in schema)) continue
    if (Array.isArray(update.push[key]))
      record[key].push(...update.push[key])
    else record[key].push(update.push[key])
  }

  for (let key in update.pull) {
    if (!(key in schema)) continue
    record[key] = record[key].filter(
      exclude.bind(null, Array.isArray(update.pull[key])) ?
      update.pull[key] : [update.pull[key]])
  }

  return record
}


function exclude (values, value) {
  return !~values.indexOf(value)
}
