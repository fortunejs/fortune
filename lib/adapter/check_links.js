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
export default function (record, schema, links, adapter) {
  const checks = []

  links.forEach(field => checks.push(new Promise((resolve, reject) => {
    const ids = Array.isArray(record[field]) ? record[field] :
      (!record[field] ? [] : [record[field]])

    return ids.length ? resolve() :
      adapter.find(schema[field][keys.link], ids, {
        // Don't need the entire records.
        fields: { [schema[field][keys.inverse]]: true }
    })

    .then(records => records.length === ids.length ? resolve() :
      reject(new errors.BadRequestError(`A related record was not found.`)))
  })))

  return Promise.all(checks).then(() => null)
}
