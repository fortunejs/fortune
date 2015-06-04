import Serializer from './'


/**
 * Default serializer implementation. It doesn't have an ID, because it doesn't
 * need one.
 */
export default class DefaultSerializer extends Serializer {

  showResponse (context, records, include) {
    const { response } = context

    if (!records) {
      response.payload = Object.keys(this.recordTypes)
      return context
    }

    if (include) records.include = include
    response.payload = records

    return context
  }


  showError (context, error) {
    const { response } = context
    const { stack } = error

    response.payload = stack ? stack : error.toString()

    return context
  }


  parseCreate (context) {
    const { errors } = this
    const { ids } = context.request
    const records = context.request.payload

    if (ids)
      throw new errors.BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(records) || !records.length)
      throw new errors.BadRequestError(`Records are unspecified.`)

    return records
  }


  parseUpdate (context) {
    const { errors } = this
    const { ids } = context.request
    const updates = context.request.payload

    if (ids)
      throw new errors.BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(updates) || !updates.length)
      throw new errors.BadRequestError(`Updates are unspecified.`)

    return updates
  }

}
