// Registered media type.
export const mediaType = 'application/vnd.micro+json'

// Reserved keys from the Micro API specification.
export const reservedKeys = {
  array: '@array',
  error: '@error',
  href: '@href',
  id: '@id',
  inverse: '@inverse',
  links: '@links',
  meta: '@meta',
  operate: '@operate',
  type: '@type'
}

export const defaults = {

  // Inflect the record type name in the URL.
  inflectType: true,

  // Number of spaces to output to JSON.
  spaces: 0,

  // Maximum number of records to show per page.
  pageLimit: 1000,

  // Maximum number of fields per include.
  includeDepth: 3,

  // What encoding to use for buffer fields.
  bufferEncoding: 'base64',

  // Hyperlink prefix.
  prefix: '',

  // Queries to support.
  queries: new Set([
    'include', 'limit', 'offset', 'match', 'sort', 'field'
  ]),

  // URI Template. See RFC 6570:
  // https://tools.ietf.org/html/rfc6570
  uriTemplate: '{/type,ids,relatedField}{?query*}'

}

// Regular expressions.
export const inBrackets = /\[([^\]]+)\]/
export const isField = /^field/
export const isMatch = /^match/
