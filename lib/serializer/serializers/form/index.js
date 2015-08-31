import Busboy from 'busboy'
import stream from 'stream'


const formUrlEncodedType = 'application/x-www-form-urlencoded'
const formDataType = 'multipart/form-data'


function processRequest () {
  throw new this.errors.UnsupportedError(`Form input only.`)
}


function parseUpdate () {
  throw new this.errors.UnsupportedError(`Can not update records.`)
}


function parseCreate (context) {
  const { request: { meta, payload, type } } = context
  const { keys, recordTypes, options, castValue } = this
  const fields = recordTypes[type]
  const busboy = new Busboy({ headers: meta })
  const bufferStream = new stream.PassThrough()
  const record = {}

  return new Promise(resolve => {
    busboy.on('file', (field, file, filename) => {
      const fieldDefinition = fields[field] || {}
      const fieldIsArray = fieldDefinition[keys.isArray]
      const chunks = []

      if (fieldIsArray && !(field in record)) record[field] = []

      file.on('data', chunk => chunks.push(chunk))
      file.on('end', () => {
        const data = Buffer.concat(chunks)
        data.filename = filename
        if (fieldIsArray) {
          record[field].push(data)
          return
        }
        record[field] = data
      })
    })

    busboy.on('field', (field, value) => {
      const fieldDefinition = fields[field] || {}
      const fieldType = fieldDefinition[keys.type]
      const fieldIsArray = fieldDefinition[keys.isArray]

      if (fieldIsArray) {
        if (!(field in record)) record[field] = []
        record[field].push(castValue(value, fieldType, options))
        return
      }

      record[field] = castValue(value, fieldType, options)
    })

    busboy.on('finish', () => resolve([ record ]))

    bufferStream.end(payload)
    bufferStream.pipe(busboy)
  })
}


export const formUrlEncoded = Serializer => Object.assign(
class FormUrlEncodedSerializer extends Serializer {
  processRequest () { processRequest.call(this) }
  parseCreate () { return parseCreate.apply(this, arguments) }
  parseUpdate () { parseUpdate.call(this) }
}, { id: formUrlEncodedType })


export const formData = Serializer => Object.assign(
class FormDataSerializer extends Serializer {
  processRequest () { processRequest.call(this) }
  parseCreate () { return parseCreate.apply(this, arguments) }
  parseUpdate () { parseUpdate.call(this) }
}, { id: formDataType })
