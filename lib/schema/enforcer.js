import keys from './reserved_keys';

// This value gets used by other functions.
let bufferEncoding;

/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} entity
 * @param {Object} schema
 * @param {Boolean} output whether or not we are outputting an entity
 * @return {Object}
 */
export default function Enforcer (entity, schema, output) {
  bufferEncoding = Enforcer.bufferEncoding;

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
      continue;
    }

    if (!schema[key].isArray) {
      value = !output ?
        castType(entity[key], type) :
        mangleType(entity[key], type);
    } else {
      if (Array.isArray(entity[key])) {
        value = entity[key].map(!output ?
          value => castType(value, type) :
          value => mangleType(value, type));
      } else {
        value = [!output ?
          castType(entity[key], type) :
          mangleType(entity[key], type)];
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
 */
function castType (value, type) {
  const caster = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value => new Date(value),
    object: value => typeof value === 'object' ? value : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer(value) || !bufferEncoding ?
      value : new Buffer(value || '', bufferEncoding)
  };

  if (type in caster) {
    return caster[type](value);
  } else {
    if (!!type) console.warn(`The type "${type}" is unrecognized.`);
    return value;
  }
}


/*!
 * Mangle a value to be sent over the wire.
 *
 * @param value
 * @param {String} type
 */
function mangleType (value, type) {
  const mangler = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value =>  (value instanceof Date ?
      value : new Date(value)).getTime(),
    object: value => typeof value === 'object' ? value : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer(value) && !!bufferEncoding ?
      value.toString(bufferEncoding) : value
  };

  if (type in mangler) {
    return mangler[type](value);
  } else {
    if (!!type) console.warn(`The type "${type}" is unrecognized.`);
    return value;
  }
}
