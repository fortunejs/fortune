import stderr from '../common/stderr';
import keys from './reserved_keys';

/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} entity
 * @param {Object} schema
 * @param {Object} options
 * @return {Object}
 */
export default function Enforcer (entity, schema = {}, options = {}) {

  // Sanity check.
  if (typeof entity !== 'object')
    throw new Error(`Entity is not an object.`);

  for (let key in entity) {
    let value;
    let type;

    if (key in schema) {
      type = schema[key][keys.type];
    } else {
      // If the key is not in the schema, then nothing to enforce.
      if (!!options.dropArbitraryFields && !options.output)
        delete entity[key];

      continue;
    }

    if (!schema[key].isArray) {
      value = !options.output ?
        castType(entity[key], type, options) :
        mangleType(entity[key], type, options);
    } else {
      if (Array.isArray(entity[key])) {
        value = entity[key].map(!options.output ?
          value => castType(value, type, options) :
          value => mangleType(value, type, options));
      } else {
        value = [!options.output ?
          castType(entity[key], type, options) :
          mangleType(entity[key], type, options)];
      }
    }

    if (value !== undefined) {
      entity[key] = value;
    } else {
      delete entity[key];
    }
  }

  return entity;
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

  if (type in caster) {
    return caster[type](value);
  } else {
    if (!!type) stderr.warn(`The type "${type}" is unrecognized.`);
    return value;
  }
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
    date: value =>  (value instanceof Date ?
      value : new Date(value)).getTime(),
    object: value => typeof value === 'object' ? value : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer(value) && !!options.bufferEncoding ?
      value.toString(options.bufferEncoding) : value
  };

  if (type in mangler) {
    return mangler[type](value);
  } else {
    if (!!type) stderr.warn(`The type "${type}" is unrecognized.`);
    return value;
  }
}
