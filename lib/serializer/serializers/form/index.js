import qs from 'querystring'


const mediaType = 'application/x-www-form-urlencoded'


export default Serializer => Object.assign(
class FormSerializer extends Serializer {

  processRequest () {
    throw new this.errors.UnsupportedError()
  }

  parseCreate (context) {
    const { keys, recordTypes, options, castValue } = this
    const { request: { type, payload } } = context
    const fields = recordTypes[type]
    const cast = (type, options) => value => castValue(value, type, options)
    const record = qs.parse(payload.toString())

    for (let field in record) {
      const value = record[field]
      const fieldDefinition = fields[field] || {}
      const fieldType = fieldDefinition[keys.type]
      const fieldIsArray = fieldDefinition[keys.isArray]

      record[field] = fieldIsArray ?
        value.map(cast(fieldType, options)) :
        castValue(value, fieldType, options)
    }

    return [ record ]
  }

  parseUpdate () {
    throw new this.errors.UnsupportedError()
  }

}, { id: mediaType })
