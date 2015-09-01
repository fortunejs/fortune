/**
 * Apply `output` transform per record, then run the serializer.
 * This mutates `context.response`.
 *
 * @return {Promise}
 */
export default function (context) {
  const { serializer, transforms } = this
  const { request, response } = context
  const { type } = request
  const transform = transforms[type]
  const { records, include } = response

  // Delete temporary keys.
  delete response.records
  delete response.include

  // Run transforms on primary type.
  return (records ? Promise.all(records.map(record =>
    Promise.resolve(transform && transform.output ?
      transform.output(context, record) : record)))

  .then(updatedRecords => {
    for (let i = 0; i < updatedRecords.length; i++)
      records[i] = updatedRecords[i]

    if (!include) return null

    // The order of the keys and their corresponding indices matter. Since it
    // is an associative array, we are not guaranteed any particular order,
    // but the order that we get matters.
    const includeTypes = Object.keys(include)

    // Run output transforms per include type.
    return Promise.all(includeTypes.map(includeType =>
      Promise.all(include[includeType].map(record => Promise.resolve(
        transforms[includeType] && transforms[includeType].output ?
          transforms[includeType].output(context, record) : record)))))

    .then(types => types.reduce((include, records, index) => {
      include[includeTypes[index]] = records
      return include
    }, {}))
  }) : Promise.resolve())

  .then(include => {
    const args = [ context ]

    if (records) args.push(records)
    if (include) args.push(include)

    return serializer.showResponse(...args)
  })
}
