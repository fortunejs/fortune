module.exports = enforcer;


/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} object
 * @param {Object} schema
 * @param {Boolean} output whether or not we are outputting an entity
 * @return {Object}
 */
function enforcer (object, schema, output) {
  var key;
  var value;
  var type;

  for (key in object) {

    if (schema.hasOwnProperty(key)) {
      type = schema[key].type;
    } else {
      if (!output) {
        delete object[key];
      }
      continue;
    }

    if (!schema[key].isArray) {
      value = !output ?
        castType(object[key], type) : mangleType(object[key], type);
    } else {
      if (Array.isArray(object[key])) {
        value = object[key].map(
          !output ? castTypeMap(type) : mangleTypeMap(type));
      } else {
        value = [!output ?
          castType(object[key], type) : mangleType(object[key], type)];
      }
    }

    if (value !== undefined) {
      object[key] = value;
    } else {
      delete object[key];
    }

  }

  function castTypeMap (type) {
    return function (value) {
      return castType(value, type);
    };
  }

  function mangleTypeMap (type) {
    return function (value) {
      return mangleType(value, type);
    };
  }

  return object;
}


/*!
 * Cast a value into a type.
 *
 * @param value
 * @param {String} type
 */
function castType (value, type) {
  var caster = {
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

  if (caster.hasOwnProperty(type)) {
    return caster[type](value);
  } else {
    if (!!type) {
      console.warn('The type "' + type + '" is unrecognized.');
    }
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
  var mangler = {
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
      return new Date(value).getTime();
    },
    object: function (value) {
      return value;
    },
    array: function (value) {
      if (Array.isArray(value)) {
        return value;
      } else {
        return null;
      }
    },
    buffer: function (value) {
      if (Buffer.isBuffer(value)) {
        return value.toString('base64');
      } else {
        return null;
      }
    }
  };

  if (mangler.hasOwnProperty(type)) {
    return mangler[type](value);
  } else {
    if (!!type) {
      console.warn('The type "' + type + '" is unrecognized.');
    }
    return value;
  }
}
