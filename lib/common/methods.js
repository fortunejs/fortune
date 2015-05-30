// Used for the method of a request.

export const find = Symbol('find')
export const create = Symbol('create')
export const update = Symbol('update')

// Special case for delete, since it is a reserved keyword.
const del = Symbol('delete')
export { del as delete }
