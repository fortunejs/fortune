import * as keys from '../common/reserved_keys'


/**
 * Do static analysis on the `schemas` object to see if `link` and `inverse`
 * values are valid.
 */
export default function (schemas) {
  for (let name in schemas) {
    const schema = schemas[name]

    for (let field in schema) {
      const definition = schema[field]

      if (definition.hasOwnProperty(keys.link)) {
        if (!schemas.hasOwnProperty(definition[keys.link]))
          throw new Error(`The value for "${keys.link}" on "${field}" is ` +
            `invalid, the record type does not exist.`)

        const linkedSchema = schemas[definition[keys.link]]

        if (!linkedSchema.hasOwnProperty(definition[keys.inverse]))
          throw new Error(`The value for "${keys.inverse} on "${field}" ` +
            `is invalid, the field does not exist.`)

        if (linkedSchema[definition[keys.inverse]][keys.inverse] !== field)
          throw new Error(`The value for "${keys.inverse} on "${field}" ` +
            `is invalid, the inversely related field must define its ` +
            `inverse as "${field}".`)
      }
    }
  }
}
