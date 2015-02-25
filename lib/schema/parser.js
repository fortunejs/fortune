import stderr from '../common/stderr';
import keys from './reserved_keys';


// Valid string literal types.
const types = ['string', 'number', 'boolean',
  'date', 'object', 'array', 'buffer'];

/*!
 * Given a schema object, turn the values of the fields into something that
 * is more verbose and easier to use. The input `[Number]` may produce output
 * that looks something like:
 *
 * ```js
 * {
 *   type: 'number',
 *   isArray: true
 * }
 * ```
 *
 * Returns the schema, but mutated.
 *
 * @param {Object} schema
 * @param {Object} [options]
 * @param {String} [type]
 * @return {Object}
 */
export default function Parser (schema = {}, options = {}) {
  for (let key in schema) {
    let output = {};
    let value = schema[key];

    if (typeof value === 'function' || typeof value === 'string') {
      output.type = coerceString(value);
    } else if (typeof value === 'object' && value !== null) {
      output = parseObject(value, key);
    } else {
      stderr.warn(`The definition of schema field "${key}" is invalid.`);
    }

    if (keys.type in output && !output[keys.type]) {
      stderr.warn(`Invalid type for "${key}".`);
      delete output.type;
    }

    if (Object.keys(output).length) {
      schema[key] = output;
    } else {
      delete schema[key];
    }
  }

  Object.defineProperties(schema, {

    // Store schema options on the schema object.
    _options: {
      value: options
    },

    // Store an hash keyed by links. This is used internally
    // by the dispatcher.
    _links: {
      value: Object.keys(schema).reduce((hash, field) => {
        if (!!schema[field][keys.link])
          hash[field] = true;
        return hash;
      }, {})
    }

  });

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
  let type;

  if (typeof constructor === 'string') {
    if (~types.indexOf(constructor)) {
      type = constructor;
    } else {
      stderr.warn(`The type "${constructor}" is unrecognized.`);
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
      stderr.warn(`Unknown type for "${type}".`);
    }

  } else {
    stderr.warn(`Invalid type "${constructor}".`);
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
  let output = {};

  value = coerceSingular(value, output, keys.type, key);

  // `function` here refers to the type of a native object such as `String`.
  if (typeof value === 'function') {
    output.type = coerceString(value);
  }

  // Process each of the attributes, there are a few reserved names.
  for (let attribute in value) {
    if (attribute === keys.link) {

      value[attribute] = coerceSingular(
        value[attribute], output, attribute, key);

      if (typeof value[attribute] === 'string' && value[attribute].length) {
        output.link = value[attribute];
      } else {
        stderr.warn(`The "${attribute}" key on the schema field "${key}" ` +
          `must be a string or array of strings. The "${key}" field ` +
          `has been dropped.`);
      }

    } else if (attribute === keys.inverse) {

      if (typeof value[attribute] === 'string' && value[attribute].length) {
        output.inverse = value[attribute];
      } else {
        stderr.warn(`The "${attribute}" key on the schema field "${key}" ` +
          `must be a string. The "${attribute}" key has been dropped.`);
      }

    } else if (attribute === keys.type) {

      value[attribute] = coerceSingular(
        value[attribute], output, attribute, key);
      output.type = coerceString(value[attribute]);

    } else {

      output[attribute] = value[attribute];

    }
  }

  // Do some sanity checking.
  // Link and type are not allowed, because a link's type is not meant to be
  // specified by the user.
  if (keys.type in output && keys.link in output) {
    delete output[keys.type];
    stderr.warn(`The field "${key}" can not have both of the keys ` +
      `"${keys.link}" and "${keys.type}". The "${keys.type}" ` +
      `key has been dropped.`);
  }

  // Must have either a type or a link, otherwise it is invalid.
  if (!output[keys.type] && !output[keys.link]) {
    stderr.warn(`The schema field "${key}" must contain either ` +
      `"${keys.type}" or "${keys.link}" keys.`);
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
    if (!value.length) {
      stderr.warn(`Empty array in "${type}" of key "${key}".`);
      return {};
    }
    if (value.length > 1) {
      stderr.warn(`Only the first value of "${type}" ` +
        `will be used on key "${key}".`);
    }
    value = value[0];
    output[keys.isArray] = true;
  } else {
    output[keys.isArray] = false;
  }
  return value;
}
