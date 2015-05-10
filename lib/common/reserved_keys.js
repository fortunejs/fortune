// The primary key.
export const primary = 'id'

// The names of certain reserved keys per field.
export const type = 'type'
export const link = 'link'
export const inverse = 'inverse'
export const isArray = 'isArray'

// Special case: denormalized inverse should be hidden.
export const denormalizedInverse = Symbol()
