import * as errors from '../common/errors'


/**
 * An update can not have the same field in `set`, `unset`, `push`, or `pull`.
 *
 * @param {Object} update
 */
export default function validateUpdate (update) {
  const set = new Set();

  ['set', 'unset', 'push', 'pull'].forEach(operation => {
    for (let field in update[operation]) {
      if (!set.has(field)) set.add(field)
      else throw new errors.BadRequestError(`A field is not allowed in ` +
        `multiple operations at once.`)
    }
  })
}
