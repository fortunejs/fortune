// Registered media type.
export const mediaType = 'application/vnd.micro+json'

// Reserved keys from the Micro API specification.
export const reservedKeys = {
  array: '@array',
  error: '@error',
  id: '@id',
  inverse: '@inverse',
  links: '@links',
  meta: '@meta',
  operate: '@operate',
  type: '@type',
  graph: '@graph'
}

export const defaults = {

  // Inflect the record type name in the URI, assuming that the record type
  // name is singular.
  inflectPath: true,

  // Maximum number of records to show per page.
  maxLimit: 1000,

  // Maximum number of fields per include.
  includeLimit: 3,

  // What encoding to use for input buffer fields.
  bufferEncoding: 'base64',

  // Obfuscate URIs to encourage use of hypermedia.
  obfuscateURIs: true,

  // Hyperlink prefix, without trailing slash.
  prefix: '',

  // Queries to support.
  queries: new Set([
    'include', 'limit', 'offset', 'match', 'sort', 'field'
  ]),

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField}{?query*}',

  // What HTTP methods may be allowed, ordered by appearance in URI template.
  allowLevel: [
    [ 'GET' ], // Index
    [ 'GET', 'POST', 'PATCH', 'DELETE' ], // Collection
    [ 'GET', 'PATCH', 'DELETE' ], // Records
    [ 'GET', 'PATCH', 'DELETE' ] // Related records
  ]

}

// Regular expressions.
export const inBrackets = /\[([^\]]+)\]/
export const isField = /^field/
export const isMatch = /^match/
