import keys from './reserved_keys';

/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} entity
 * @param {Object} schema
 * @param {Boolean} output whether or not we are outputting an entity
 * @return {Object}
 */
export default function Enforcer (entity, schema, output) {

  // Sanity check.
  if (typeof entity !== 'object')
    throw new Error('Entity is not an object.');

  for (let key in entity) {
    let value;
    let type;

    if (key in schema) {
      type = schema[key][keys.type];
    } else {
      if (!output) {
        delete entity[key];
      }
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
    object: value => typeof value === 'object' ? new Object(value) : {},
    array: value => Array.isArray(value) ? value : [value],
    buffer: value => Buffer.isBuffer ? value : new Buffer(value || '', 'base64')
  };

  if (type in caster) {
    return caster[type](value);
  } else {
    if (!!type) console.warn('The type "' + type + '" is unrecognized.');
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
    date: value =>  new Date(value).getTime(),
    object: value => value,
    array: value => Array.isArray(value) ? value : value,
    buffer: value => Buffer.isBuffer(value) ? value.toString('base64') : value
  };

  if (type in mangler) {
    return mangler[type](value);
  } else {
    if (!!type) console.warn('The type "' + type + '" is unrecognized.');
    return value;
  }
}
