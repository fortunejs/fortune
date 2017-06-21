'use strict'

/**
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
module.exports = function (context) {
  var transaction = context.transaction
  var request = context.request
  var type = request.type
  var ids = request.ids
  var options = request.options
  var meta = request.meta

  if (!type) return context

  return transaction.find(type, ids, options, meta)
    .then(function (records) {
      Object.defineProperty(context.response, 'records', {
        configurable: true,
        value: records
      })

      return context
    })
}
