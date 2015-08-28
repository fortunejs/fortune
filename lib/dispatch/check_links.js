import * as keys from '../common/keys'


/**
 * Ensure referential integrity by checking if related records exist.
 *
 * @param {Object} record
 * @param {Object} fields
 * @param {Array} links - An array of strings indicating which fields are
 * links. Need to pass this so that it doesn't get computed each time.
 * @param {Object} [meta]
 * @return {Promise}
 */
export default function checkLinks (record, fields, links, meta) {
  const { adapter, options: { enforceLinks } } = this

  return Promise.all(links.map(field => new Promise((resolve, reject) => {
    const ids = Array.isArray(record[field]) ? record[field] :
      !(field in record) || record[field] === null ? [] : [ record[field] ]

    return !ids.length ? resolve() :
    adapter.find(fields[field][keys.link], ids, {
      // Don't need the entire records.
      fields: { [fields[field][keys.inverse]]: true }
    }, meta)

    .then(records => {
      if (enforceLinks) {
        const recordIds = new Set(records.map(record => record[keys.primary]))

        for (let id of ids) if (!recordIds.has(id))
          return reject(new Error(
            `A related record for the field "${field}" was not found.`))
      }

      return resolve(records)
    })
  })))

  .then(partialRecords => {
    const object = {}

    for (let index = 0; index < partialRecords.length; index++) {
      const records = partialRecords[index]

      if (records) object[links[index]] =
        fields[links[index]][keys.isArray] ? records : records[0]
    }

    return object
  })
}
