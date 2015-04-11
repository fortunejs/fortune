import errors from '../../common/errors'


/*!
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type

  if (!type) return context

  let ids = context.request.ids
  let options = context.request.options
  let args = [type, ids]

  if (options) args.push(options)

  return this.adapter.find(...args).then(records => {
    if (ids.length) {
      if (!records.length)
        throw new errors.NotFoundError(`No records match your request.`)
      if (records.length > ids.length)
        throw new Error(`Too many records matched your request.`)
    }

    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    return context
  })
}
