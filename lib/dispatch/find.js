/**
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  const { adapter } = this
  const { type, ids, options, meta } = context.request

  if (!type) return context

  const args = [ type, ids ]

  args.push(options ? options : null)
  if (meta) args.push(meta)

  return adapter.find(...args).then(records => {
    Object.defineProperty(context.response, 'records', {
      configurable: true,
      value: records
    })

    return context
  })
}
