import stderr from '../common/stderr';
import keys from './reserved_keys';


/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} record
 * @param {Object} schema
 * @param {Object} options
 * @return {Object}
 */
export default function Enforcer (record, schema = {}, options = {}) {
  // Sanity check.
  if (typeof record !== 'object')
    throw new Error(`Record is not an object.`);

  let enforceValue = (key, type) => {
    if (!schema[key].isArray)
      return !options.output ?
        castType(record[key], type, options) :
        mangleType(record[key], type, options);

    if (Array.isArray(record[key]))
      return record[key].map(!options.output ?
        value => castType(value, type, options) :
        value => mangleType(value, type, options));

    return [!options.output ?
      castType(record[key], type, options) :
      mangleType(record[key], type, options)];
  };

  for (let key in record) {
    if (!(key in schema)) {
      // If the key is not in the schema, then nothing to enforce.
      if (!!options.dropArbitraryFields && !options.output)
        delete record[key];

      continue;
    }

    let type = schema[key][keys.type];
    let value = enforceValue(key, type);

    if (value !== undefined) {
      record[key] = value;
    } else {
      delete record[key];
    }
  }

  return record;
}


/*!
 * Cast a value into a type.
 *
 * @param value
 * @param {String} type
 * @param {Object} options
 */
function castType (value, type, options) {
  const caster = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value => new Date(value),
    object: value => typeof value === 'object' ? value : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer(value) || !options.bufferEncoding ?
      value : new Buffer(value || '', options.bufferEncoding)
  };

  if (type in caster)
    return caster[type](value);

  if (type) stderr.warn(`The type "${type}" is unrecognized.`);
  return value;
}


/*!
 * Mangle a value to be sent over the wire.
 *
 * @param value
 * @param {String} type
 * @param {Object} options
 */
function mangleType (value, type, options) {
  const mangler = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value => (value instanceof Date ?
      value : new Date(value)).getTime(),
    object: value => typeof value === 'object' ? value : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer(value) && !!options.bufferEncoding ?
      value.toString(options.bufferEncoding) : value
  };

  if (type in mangler)
    return mangler[type](value);

  if (type) stderr.warn(`The type "${type}" is unrecognized.`);

  return value;
}
