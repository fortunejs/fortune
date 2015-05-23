import * as keys from '../common/reserved_keys'
import * as errors from '../common/errors'


/**
 * Ensure referential integrity by checking if related records exist.
 *
 * @param {Object} record
 * @param {Object} schema
 * @param {Set} links a set of strings indicating which fields are links
 * @param {Object} adapter
 * @return {Promise}
 */
export default function checkLinks (record, schema, links, adapter) {
  const linkFields = [ ...links ]

  return Promise.all(linkFields.map(field => new Promise((resolve, reject) => {
    const ids = Array.isArray(record[field]) ? record[field] :
      !(field in record) || record[field] === null ? [] : [ record[field] ]

    return !ids.length ? resolve() :
      adapter.find(schema[field][keys.link], ids, {
        // Don't need the entire records.
        fields: { [schema[field][keys.inverse]]: true }
    })

    .then(records => records.length < ids.length ?
      reject(new errors.BadRequestError(`A related record was not found.`)) :
      resolve(records))
  })))

  .then(partialRecords => {
    const object = {}

    for (let index = 0; index < partialRecords.length; index++) {
      const records = partialRecords[index]

      if (records)
        object[linkFields[index]] =
          schema[linkFields[index]][keys.isArray] ? records : records[0]
    }

    return object
  })
}
