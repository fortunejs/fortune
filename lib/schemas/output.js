module.exports = output;


/**
 * Some data types can't be transmitted 1:1 over the wire,
 * so some mangling must be done.
 *
 * @param {Object} object
 * @param {Object} schema
 * @return {Object}
 */
function output (object, schema) {
  var key;
  var value;
  var type;

  for (key in object) {

    if (schema.hasOwnProperty(key)) {
      type = schema[key];
    } else {
      delete object[key];
      continue;
    }

    if (!schema[key].isArray) {
      value = castType(object[key], type);
    } else {
      if (Array.isArray(object[key])) {
        value = object[key].map(coerceValue(type));
      } else {
        value = [castType(object[key], type)];
      }
    }

    if (value !== undefined) {
      object[key] = value;
    } else {
      delete object[key];
    }

  }

  function coerceValue (type) {
    return function (value) {
      return castType(value, type);
    };
  }

  return object;
}
