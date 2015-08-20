import { toBuffer } from 'array-buffer'
import * as keys from '../../common/keys'
import { BadRequestError } from '../../common/errors'


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
        if (field === keys.primary) continue
        if ((isInclude && !(field in options.fields)) ||
          (isExclude && field in options.fields))
          delete record[field]
      }
  }

  for (let field in options.sort)
    records = records.sort(sortByField.bind(null,
      fields[field], field, options.sort[field]))

  if ('limit' in options || 'offset' in options)
    records = records.slice(options.offset,
      options.offset && options.limit ?
      options.offset + options.limit : options.limit)

  records.count = count

  return records
}


const primitiveTypes = new Set([ Number, String, Boolean, Symbol ])

const matchCheck = new WeakMap([
  [ Date, (a, b) => a.getTime() === b.getTime() ],
  [ Buffer, (a, b) => a.equals(toBuffer(b)) ],
  [ Object, () => false ]
])

function check (a, b) {
  return this.isPrimitive ? a === b : matchCheck.get(this.type)(a, b)
}


function matchByField (fields, match, record) {
  for (let field in match) {
    if (record[field] === null) return false

    const type = fields[field][keys.type]
    const isPrimitive = fields[field][keys.link] || primitiveTypes.has(type)

    let matches = match[field]
    if (!Array.isArray(match[field])) matches = [ matches ]

    for (let x of matches)
      if (fields[field][keys.isArray] ?
        !record[field].some(check.bind({ isPrimitive, type }, x)) :
        !check.call({ isPrimitive, type }, x, record[field]))
        return false
  }

  return true
}


const comparisons = new WeakMap([
  [ Number, (a, b) => a - b ],
  [ String, (a, b) => a.charCodeAt(0) - b.charCodeAt(0) ],
  [ Boolean, (a, b) => a === b ? 0 : a ? 1 : -1 ],
  [ Date, (a, b) => a.getTime() - b.getTime() ],
  [ Buffer, (a, b) => a.length - b.length ],
  [ Object, (a, b) => Object.keys(a).length - Object.keys(b).length ]
])


function sortByField (fieldDefinition, field, isAscending, a, b) {
  [ a, b ] = [ a[field], b[field] ]

  if (a === null || b === null) return 0

  let result = 0

  if (fieldDefinition[keys.isArray])
    result = a.length - b.length

  else if (keys.type in fieldDefinition)
    result = comparisons.get(fieldDefinition[keys.type])(a, b)

  return isAscending ? result : -result
}


// Browser-safe ID generation.
export function generateId () {
  return ('00000000' + Math.floor(Math.random() * Math.pow(2, 32))
    .toString(16)).slice(-8)
}
