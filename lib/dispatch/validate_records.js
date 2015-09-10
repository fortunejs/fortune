import { includes } from '../common/array_proxy'
import { BadRequestError } from '../common/errors'
import {
  link as linkKey,
  inverse as inverseKey,
  isArray as isArrayKey
} from '../common/keys'


/**
 * Do some validation on records to be created or updated to determine
 * if there are any records which have overlapping to-one relationships.
 *
 * @param {Object[]} records
 * @param {Object} fields
 * @param {Object} links
 * @return {Object[]}
 */
export default function validateRecords (records, fields, links) {
  const { recordTypes } = this
  const toOneMap = {}

  for (let field of links) {
    const fieldLink = fields[field][linkKey]
    const fieldInverse = fields[field][inverseKey]
    const inverseIsArray = recordTypes[fieldLink][fieldInverse][isArrayKey]

    if (!inverseIsArray) {
      toOneMap[field] = []

      for (let record of records) {
        const value = record[field]
        const ids = Array.isArray(value) ? value : value ? [ value ] : []

        for (let id of ids)
          if (!includes(toOneMap[field], id)) toOneMap[field].push(id)
          else throw new BadRequestError(`Multiple records can not have the ` +
            `same to-one link value on the field "${field}".`)
      }
    }
  }

  return records
}
