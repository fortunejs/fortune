// the names of the publicly exposed keys
var keys = {
  type: 'type',
  link: 'link',
  inverse: 'inverse'
};
var resource;


module.exports = parser;


/*!
 * Given a schema object, turn the values of the fields into something that is
 * more verbose and easier to use. The output looks something like:
 *
 * ```js
 * {
 *   type: 'number',
 *   isArray: true
 * }
 * ```
 *
 * @param {String} name
 * @param {Object} schema
 * @param {Object} options
 * @return {Object}
 */
function parser (name, schema, options) {
  var key;
  var output;

  resource = name;

  options = options || {};
  if (typeof options !== 'object') {
    warn('Options parameter must be an object.');
    options = {};
  }

  if (typeof schema !== 'object') {
    warn('Schema parameter must be an object.');
    schema = {};
  }

  for (key in schema) {
    output = {};

    if (~['function', 'string'].indexOf(typeof schema[key])) {
      output.type = coerceString(schema[key]);
    } else if (typeof schema[key] === 'object') {
      output = parseObject(schema[key], key);
    } else {
      warn('The definition of schema field "' + key + '" is invalid.');
    }

    if (Object.keys(output).length) {
      schema[key] = output;
    } else {
      delete schema[key];
    }
  }

  schema._options = options;
  return schema;
}


/*!
 * Coerce a native constructor such as Number or String
 * into a string literal. This makes checking types more straightforward.
 *
 * @param {Function|String} constructor
 * @return {String}
 */
function coerceString (constructor) {
  var type;

  // valid string literal types
  var types = ['string', 'number', 'boolean', 'date', 'object', 'array', 'buffer'];

  if (typeof constructor === 'string') {
    if(~types.indexOf(constructor)) {
      type = constructor;
    } else {
      warn('The type "' + constructor + '" is unrecognized. Defaulting to "string".');
      type = 'string';
    }

  } else if (typeof constructor === 'function') {
    // native constructors need to be disambiguated
    if (constructor === String) type = 'string';
    else if (constructor === Number) type = 'number';
    else if (constructor === Boolean) type = 'boolean';
    else if (constructor === Date) type = 'date';
    else if (constructor === Object) type = 'object';
    else if (constructor === Array) type = 'array';
    else if (constructor === Buffer) type = 'buffer';
    else {
      warn('Unknown type warning for ' + type + ', defaulting to "string".');
      type = 'string';
    }

  } else {
    warn('Invalid type "' + constructor + '". Defaulting to "string".');
    type = 'string';
  }

  return type;
}


/*!
 * Parse an object on a schema field.
 *
 * @param {Object} value
 * @param {String} key
 * @return {Object}
 */
function parseObject (value, key) {
  var output = {};

  value = coerceSingular(value, output, keys.type, key);

  if (typeof value === 'function') {

    output.type = coerceString(value);

  } else if (value.hasOwnProperty(keys.link)) {

    value[keys.link] = coerceSingular(value[keys.link], output, keys.link, key);

    if (typeof value[keys.link] === 'string' && value[keys.link].length) {
      output.link = value[keys.link];
    } else {
      warn('The "' + keys.link + '" key on the schema field "' + key +
        '" must be a string or array of strings. The "' + key + '" field has been dropped.');
      return {};
    }

    if (value.hasOwnProperty(keys.inverse)) {
      if (typeof value[keys.inverse] === 'string' && value[keys.inverse].length) {
        output.inverse = value[keys.inverse];
      } else {
        warn('The "' + keys.inverse + '" key on the schema field "' + key +
          '" must be a string. The "' + keys.inverse + '" key has been dropped.');
      }
    }

    if(value.hasOwnProperty(keys.type)) {
      delete value[keys.type];
      warn('The field "' + key + '" can not have both of the keys "' + keys.link +
        '" and "' + keys.type + '". The "' + keys.type + '" key has been dropped.');
    }

  } else if (value.hasOwnProperty(keys.type)) {

    value[keys.type] = coerceSingular(value[keys.type], output, keys.type, key);
    output.type = coerceString(value[keys.type]);

  } else {

    warn('A schema field object must contain either "' + keys.type + '" or "' +
      keys.link + '" keys.');
    return {};

  }

  return output;
}


/*!
 * Coerce an array into the first value of the array.
 * Causes a side effect on `output` object.
 *
 * @param {Object} value
 * @param {Object} output
 * @param {String} type
 * @param {String} key
 */
function coerceSingular (value, output, type, key) {
  if (Array.isArray(value)) {
    if(value.length > 1) {
      warn('Only the first value of "' + type + '" will be used on key "' + key + '".');
    }
    value = value[0];
    output.isArray = true;
  }
  return value;
}


/*!
 * Send a warning.
 *
 * @param {String} str
 */
function warn (str) {
  console.warn('On "' + resource + '" resource: ' + str);
}
