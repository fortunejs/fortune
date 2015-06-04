// The primary key that must exist per record, can not be user defined.
export const primary = 'id'

// The names of certain reserved keys per field definition.
export const type = 'type'
export const link = 'link'
export const inverse = 'inverse'
export const isArray = 'isArray'

// Special case: denormalized inverse key should be hidden.
export const denormalizedInverse = Symbol('denormalizedInverse')
