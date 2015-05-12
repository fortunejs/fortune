/**
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  const { serializer, adapter } = this
  const { type, ids, options } = context.request

  if (!type) {
    context = serializer.showResponse(context)
    return context
  }

  const args = [ type, ids ]

  if (options) args.push(options)

  return adapter.find(...args).then(records => {
    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    return context
  })
}
