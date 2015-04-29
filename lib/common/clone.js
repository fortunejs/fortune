/**
 * Clone a record semi-deeply, for use with the update object.
 *
 * @param {Object} record
 * @return {Object}
 */
export default function clone (record) {
  const clone = {}

  for (let key in record) {
    if (Array.isArray(record[key])) {
      clone[key] = record[key].slice()
      continue
    }

    clone[key] = record[key]
  }

  return clone
}
