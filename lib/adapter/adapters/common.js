import deepEqual from 'deep-equal'
import { toBuffer } from 'array-buffer'
import { primary as primaryKey, isArray as isArrayKey,
  type as typeKey } from '../../common/keys'
import { BadRequestError } from '../../common/errors'
import deepEqualOptions from '../../common/deep_equal_options'


export function applyOptions (count, fields, records, options) {
  if (!options) options = {}

  if ('match' in options) {
    records = records.filter(matchByField.bind(null, fields, options.match))
    count = records.length
  }

  if ('fields' in options) {
    const isInclude = Object.keys(options.fields)
      .every(field => options.fields[field])
    const isExclude = Object.keys(options.fields)
      .every(field => !options.fields[field])

    if (!(isInclude || isExclude))
      throw new BadRequestError(`Fields format is invalid.`)

    for (let record of records)
      for (let field in record) {
        if (field === primaryKey) continue
        if ((isInclude && !(field in options.fields)) ||
          (isExclude && field in options.fields))
          delete record[field]
      }
  }

  if ('sort' in options)
    records = records.sort(compare.bind(null, fields, options.sort))

  if ('limit' in options || 'offset' in options)
    records = records.slice(options.offset,
      options.offset && options.limit ?
      options.offset + options.limit : options.limit)

  records.count = count

  return records
}


const matchCheck = new WeakMap([
  [ Date, (a, b) => a.getTime() === b.getTime() ],
  [ Buffer, (a, b) => a.equals(toBuffer(b)) ],
  [ Object, (a, b) => deepEqual(a, b, deepEqualOptions) ]
])


function check (type, a, b) {
  if (b === null) return a === null
  const matcher = matchCheck.get(type)
  return matcher ? matcher(a, b) : a === b
}


function matchByField (fields, match, record) {
  const checkValue = (fieldDefinition, a, b) =>
    fieldDefinition[isArrayKey] ?
      a.some(check.bind(null, fieldDefinition[typeKey], b)) :
      check(fieldDefinition[typeKey], b, a)

  for (let field in match) {
    let matches = match[field]
    if (!Array.isArray(match[field])) matches = [ matches ]
    if (!matches.some(checkValue.bind(null, fields[field], record[field])))
      return false
  }

  return true
}


// For comparing sort order.
const comparisons = new WeakMap([
  [ Number, (a, b) => a - b ],
  [ String, (a, b) => a < b ? -1 : a > b ? 1 : 0 ],
  [ Boolean, (a, b) => a === b ? 0 : a ? 1 : -1 ],
  [ Date, (a, b) => a.getTime() - b.getTime() ],
  [ Buffer, Buffer.compare ],

  // There is no comparison here that makes sense.
  [ Object, (a, b) => JSON.stringify(a).length - JSON.stringify(b).length ]
])


function compare (fields, sort, x, y) {
  for (let field in sort) {
    const a = x[field]
    const b = y[field]
    const isAscending = sort[field]
    const fieldDefinition = fields[field]
    const fieldIsArray = fieldDefinition[isArrayKey]
    const fieldType = fieldDefinition[typeKey]

    if (a === null) return isAscending ? -1 : 1
    if (b === null) return isAscending ? 1 : -1

    let result = 0

    if (fieldIsArray) result = a.length - b.length
    else if (fieldType) result = comparisons.get(fieldType)(a, b)

    if (result === 0) continue

    return isAscending ? result : -result
  }

  return 0
}


// Browser-safe ID generation.
export function generateId () {
  return ('00000000' + Math.floor(Math.random() * Math.pow(2, 32))
    .toString(16)).slice(-8)
}
