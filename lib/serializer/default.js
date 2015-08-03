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
    const { errors: { BadRequestError } } = this
    const { request: { ids } } = context
    const records = context.request.payload

    if (ids)
      throw new BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(records) || !records.length)
      throw new BadRequestError(`Records are unspecified.`)

    return records
  }


  parseUpdate (context) {
    const { errors: { BadRequestError } } = this
    const { request: { ids } } = context
    const updates = context.request.payload

    if (ids)
      throw new BadRequestError(`IDs should not be specified.`)

    if (!Array.isArray(updates) || !updates.length)
      throw new BadRequestError(`Updates are unspecified.`)

    return updates
  }

}