export const find = Symbol('find')
export const create = Symbol('create')
export const update = Symbol('update')

// Special case: 'delete' is a reserved word.
const del = Symbol('delete')
export { del as delete }
