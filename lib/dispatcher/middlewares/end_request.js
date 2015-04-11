import enforce from '../../schema/enforce'
import primaryKey from '../../common/primary_key'


/*!
 * Apply `after` transform per record, then run the serializer.
 * This mutates `context.response`.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type

  if (!type) return context

  let records = context.response.records || []
  let include = context.response.include || {}

  // Delete temporary keys.
  delete context.response.records
  delete context.response.include

  // Run transforms on primary type.
  return Promise.all(records.map(record => Promise.resolve(
    (this.transforms[type] || {}).hasOwnProperty('after') ?
      this.transforms[type].after(context, record) : record)))

  .then(updatedRecords => {
    records = updatedRecords

    // The order of the keys and their corresponding indices matter. Since it
    // is an associative array, we are not guaranteed any particular order,
    // but the order that we get matters.
    let includeTypes = Object.keys(include)

    // Run transforms per include type.
    return Promise.all(includeTypes.map(includeType =>
      Promise.all(include[includeType].map(record => Promise.resolve(
        (this.transforms[includeType] || {}).hasOwnProperty('after') ?
          this.transforms[includeType].after(context, record) : record)))

    )).then(types => types.reduce((include, records, index) => {
      include[includeTypes[index]] = records
      return include
    }, {}))

  }).then(include => {
    let args = [context, records]

    if (Object.keys(include).length)
      args.push(include)

    context = this.serializer.showResponse(...args)

    return context
  })
}
