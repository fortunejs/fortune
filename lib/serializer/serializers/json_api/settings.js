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
  href: 'href',
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

  // Inflect the record type name in the URI. The expectation is that the
  // record type names are singular, so this will pluralize types.
  inflectType: true,

  // Inflect the names of the fields per record. The expectation is that the
  // keys are lower camel cased, and the output is dasherized.
  inflectKeys: true,

  // Maximum number of records to show per page.
  maxLimit: 1000,

  // Maximum number of fields per include.
  includeLimit: 3,

  // What encoding to use for input buffer fields.
  bufferEncoding: 'base64',

  // Hyperlink prefix, without trailing slash.
  prefix: '',

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField,relationship}{?query*}',

  // What HTTP methods may be allowed, ordered by appearance in URI template.
  allowLevel: [
    [ 'GET' ], // Index
    [ 'GET', 'POST' ], // Collection
    [ 'GET', 'PATCH', 'DELETE' ], // Records
    [ 'GET' ], // Related
    [ 'GET', 'POST', 'PATCH', 'DELETE' ] // Relationship
  ]

}

// Regular expressions.
export const inBrackets = /\[([^\]]+)\]/
export const isField = new RegExp(`^${reservedKeys.fields}`)
export const isFilter = new RegExp(`^${reservedKeys.filter}`)
export const pageLimit = `${reservedKeys.page}[limit]`
export const pageOffset = `${reservedKeys.page}[offset]`
