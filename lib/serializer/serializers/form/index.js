import Busboy from 'busboy'
import stream from 'stream'


function inherit (Serializer) {
  return class FormSerializer extends Serializer {

    processRequest () {
      throw new this.errors.UnsupportedError(`Form input only.`)
    }

    parseCreate (context) {
      const { request: { meta, payload, type } } = context
      const { recordTypes, options, castValue,
        keys: { isArray: isArrayKey, type: typeKey } } = this
      const fields = recordTypes[type]
      const busboy = new Busboy({ headers: meta })
      const bufferStream = new stream.PassThrough()
      const record = {}

      return new Promise(resolve => {
        busboy.on('file', (field, file, filename) => {
          const fieldDefinition = fields[field] || {}
          const fieldIsArray = fieldDefinition[isArrayKey]
          const chunks = []

          if (fieldIsArray && !(field in record)) record[field] = []

          file.on('data', chunk => chunks.push(chunk))
          file.on('end', () => {
            const data = Buffer.concat(chunks)
            data.filename = filename

            if (fieldIsArray) return record[field].push(data)

            if (record[field]) {
              if (Array.isArray(record[field])) record[field].push(data)
              else record[field] = [ record[field], data ]
              return null
            }

            record[field] = data
          })
        })

        busboy.on('field', (field, value) => {
          const fieldDefinition = fields[field] || {}
          const fieldType = fieldDefinition[typeKey]
          const fieldIsArray = fieldDefinition[isArrayKey]
          value = castValue(value, fieldType, options)

          if (fieldIsArray) {
            if (!(field in record)) record[field] = []
            return record[field].push(value)
          }

          if (record[field]) {
            if (Array.isArray(record[field])) record[field].push(value)
            else record[field] = [ record[field], value ]
            return null
          }

          record[field] = value
        })

        busboy.on('finish', () => resolve([ record ]))

        bufferStream.end(payload)
        bufferStream.pipe(busboy)
      })
    }

    parseUpdate (context) {
      const { errors: { BadRequestError },
        keys: { primary: primaryKey } } = this

      return this.parseCreate(context)

      .then(records => records.map(record => {
        const id = (id => {
          // Stolen from jQuery source code:
          // https://api.jquery.com/jQuery.isNumeric/
          const float = Number.parseFloat(id)
          return id - float + 1 >= 0 ? float : id
        })(record[primaryKey])

        if (!id) throw new BadRequestError(`ID is missing.`)
        delete record[primaryKey]

        return { id, replace: record }
      }))
    }

  }
}


export const formUrlEncoded = Serializer => Object.assign(
  inherit(Serializer), { id: 'application/x-www-form-urlencoded' })


export const formData = Serializer => Object.assign(
  inherit(Serializer), { id: 'multipart/form-data' })
