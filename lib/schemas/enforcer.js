module.exports = enforcer;


/*!
 * This module typecasts the keys of an object to match the given schema.
 *
 * @param {Object} object
 * @param {Object} schema
 * @return {Object}
 */
function enforcer (object, schema) {
  var key;
  var value;

  for (key in object) {
    if (!schema[key].isArray) {
      value = coerceType(object[key], schema[key].type);
    } else {
      if (Array.isArray(object[key])) {
        value = object[key].map(coerceValue(schema[key].type));
      } else {
        value = [coerceType(object[key], schema[key].type)];
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
      return coerceType(value, type);
    };
  }

  return object;
}


/*!
 * Coerce a value into a type.
 *
 * @param value
 * @param {String} type
 */
function coerceType (value, type) {
  const constructor = {
    string: function (value) {
      return value.toString();
    },
    number: function (value) {
      return parseInt(value, 10);
    },
    boolean: function (value) {
      return !!value;
    },
    date: function (value) {
      return new Date(value);
    },
    object: function (value) {
      if (typeof value === 'object') {
        return new Object(value);
      } else {
        return null;
      }
    },
    array: function (value) {
      return new Array(value);
    },
    buffer: function (value) {
      return new Buffer(value || '', 'base64');
    }
  };

  if (constructor.hasOwnProperty(type)) {
    return constructor[type](value);
  } else {
    if (!!type) {
      console.warn('The type "' + type + '" is unrecognized.');
    }
    return value;
  }
}
