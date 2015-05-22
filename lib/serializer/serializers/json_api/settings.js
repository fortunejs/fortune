// Registered media type.
export const mediaType = 'application/vnd.api+json'

// Reserved keys from the JSON API specification.
export const reservedKeys = {
  // Document structure.
  primary: 'data',
  attributes: 'attributes',
  relationships: 'relationships',
  type: 'type',
  id: 'id',
  meta: 'meta',
  errors: 'errors',
  included: 'included',

  // Hypertext.
  links: 'links',
  related: 'related',
  self: 'self',

  // Reserved query strings.
  include: 'include',
  fields: 'fields',
  filter: 'filter',
  sort: 'sort',
  page: 'page',

  // Pagination keys.
  first: 'first',
  last: 'last',
  prev: 'prev',
  next: 'next'
}

export const defaults = {

  // Inflect the record type name in the URL.
  inflectType: true,

  // Inflect the names of the fields per record.
  inflectKeys: true,

  // Number of spaces to output to JSON.
  spaces: 2,

  // Maximum number of records to show per page.
  pageLimit: 1000,

  // Maximum number of fields per include.
  includeDepth: 3,

  // What encoding to use for buffer fields.
  bufferEncoding: 'base64',

  // Hyperlink prefix.
  prefix: '',

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}'

}

// Regular expressions.
export const inBrackets = /\[([^\]]+)\]/
export const isField = new RegExp(`^${reservedKeys.fields}`)
export const isFilter = new RegExp(`^${reservedKeys.filter}`)
export const pageLimit = `${reservedKeys.page}[limit]`
export const pageOffset = `${reservedKeys.page}[offset]`
