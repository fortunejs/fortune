import { includes } from './array_proxy'


/**
 * Given a record and an update object, apply the update on the record. Note
 * that the `operate` object is unapplied.
 *
 * @param {Object} record
 * @param {Object} update
 */
export default function applyUpdate (record, update) {
  for (let field in update.replace)
    record[field] = update.replace[field]

  for (let field in update.push) {
    const value = update.push[field]
    record[field] = record[field] ? record[field].slice() : []
    if (Array.isArray(value)) record[field].push(...value)
    else record[field].push(value)
  }

  for (let field in update.pull) {
    const value = update.pull[field]
    record[field] = record[field] ?
      record[field].slice().filter(exclude.bind(null,
        Array.isArray(value) ? value : [ value ])) : []
  }
}


function exclude (values, value) {
  return !includes(values, value)
}
