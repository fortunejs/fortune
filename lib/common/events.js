// Used for notifying changes at the end of a successful request.
export const change = Symbol('change')

// Used for actions in a request.
export const find = Symbol('find')
export const create = Symbol('create')
export const update = Symbol('update')

// Special case: delete is a reserved keyword in JavaScript.
const del = Symbol('delete')
export { del as delete }
