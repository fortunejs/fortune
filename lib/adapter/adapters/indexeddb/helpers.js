import * as arrayProxy from '../../../common/array_proxy'


export function inputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  clone[keys.primary] = keys.primary in record ?
    record[keys.primary] : generateId()

  for (let field in record) {
    clone[field] = record[field]
  }

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    // Cast Buffer to ArrayBuffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(toArrayBuffer) :
        toArrayBuffer(record[field])
      continue
    }
  }

  return clone
}


export function outputRecord (type, record) {
  const { recordTypes, keys } = this
  const clone = {}
  const fields = recordTypes[type]

  // ID business.
  clone[keys.primary] = record[keys.primary]

  for (let field in record) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]
    const fieldIsDenormalized = fields[field][keys.denormalizedInverse]

    // Cast ArrayBuffer to Buffer.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ? value.map(toBuffer) : toBuffer(value)
      continue
    }

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      Object.defineProperty(clone, field, {
        configurable: true, writable: true, value
      })
      continue
    }

    clone[field] = record[field]
  }

  return clone
}


// Return the global object. Thanks Axel Rauschmayer.
// https://gist.github.com/rauschma/1bff02da66472f555c75
export function getGlobalObject () {
  // Workers don’t have `window`, only `self`.
  if (typeof self !== 'undefined') return self // eslint-disable-line no-undef

  // Node.js detection.
  if (typeof global !== 'undefined') return global

  // Not all environments allow eval and Function. Use only as a last resort:
  return new Function('return this')() // eslint-disable-line no-new-func
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


export function matchByField (fields, match, record) {
  const { keys } = this

  for (let field in match) {
    if (record[field] === null) return false

    const type = fields[field][keys.type]
    const isPrimitive = fields[field][keys.link] || primitiveTypes.has(type)

    let matches = match[field]
    if (!Array.isArray(match[field])) matches = [ matches ]

    for (let x of matches)
      if (fields[field][keys.isArray] ? !record[field].some(check.bind({
        isPrimitive, type
      }, x)) : !check.call({ isPrimitive, type }, x, record[field]))
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


export function sortByField (fieldDefinition, field, isAscending, a, b) {
  [ a, b ] = [ a[field], b[field] ]

  if (a === null || b === null) return 0

  const { keys } = this
  let result = 0

  if (fieldDefinition[keys.isArray])
    result = a.length - b.length

  else if (keys.type in fieldDefinition)
    result = comparisons.get(fieldDefinition[keys.type])(a, b)

  return isAscending ? result : -result
}


export function exclude (values, value) {
  return !arrayProxy.includes(values, value)
}


// Thanks kraag22.
// http://stackoverflow.com/a/17064149/4172219
function toBuffer (arrayBuffer) {
  return new Buffer(new Uint8Array(arrayBuffer))
}


// Thanks Martin Thomson.
// http://stackoverflow.com/a/12101012/4172219
function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; i++)
    view[i] = buffer[i]

  return arrayBuffer
}


// Hopefull we don't need to do this.
function generateId () {
  return Math.floor(Math.random() * Math.pow(2, 128)).toString(16)
}
