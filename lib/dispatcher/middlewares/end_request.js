/*!
 * Apply `output` transform per record, then run the serializer.
 * This mutates `context.response`.
 *
 * @return {Promise}
 */
export default function (context) {
  const { serializer, transforms } = this
  const { type } = context.request

  if (!type) return context

  let records = context.response.records || []
  let include = context.response.include || {}

  // Delete temporary keys.
  delete context.response.records
  delete context.response.include

  // Run transforms on primary type.
  return Promise.all(records.map(record => Promise.resolve(
    'output' in (transforms[type] || {}) ?
      transforms[type].output(context, record) : record)))

  .then(updatedRecords => {
    records = updatedRecords

    // The order of the keys and their corresponding indices matter. Since it
    // is an associative array, we are not guaranteed any particular order,
    // but the order that we get matters.
    const includeTypes = Object.keys(include)

    // Run output transforms per include type.
    return Promise.all(includeTypes.map(includeType =>
      Promise.all(include[includeType].map(record => Promise.resolve(
        'output' in (transforms[includeType] || {}) ?
          transforms[includeType].output(context, record) : record)))

    )).then(types => types.reduce((include, records, index) => {
      include[includeTypes[index]] = records
      return include
    }, {}))

  }).then(include => {
    const args = [ context, records ]

    if (Object.keys(include).length)
      args.push(include)

    context = serializer.showResponse(...args)

    return context
  })
}
