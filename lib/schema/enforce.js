import primaryKey from '../common/primary_key';
import stderr from '../common/stderr';
import keys from './reserved_keys';

const inputMap = new WeakMap([
  [String, value => typeof value === 'string' ? value :
    (value || '').toString()],
  [Number, value => typeof value === 'number' ? value :
    parseFloat((value || '').toString())],
  [Boolean, value => typeof value === 'boolean' ? value :
    !!value],
  [Date, value => value instanceof Date ? value :
    new Date(value)],
  [Object, value => value instanceof Object ?
    value : {}],
  [Buffer, value => Buffer.isBuffer(value) ? value :
    new Buffer(value)]
]);


/**
 * Cast value types to match the given schema. Returns the mutated record.
 *
 * @param {Object} record
 * @param {Object} schema
 * @return {Object}
 */
export default function enforce (record, schema) {
  let key;
  let mapValue = value => inputMap.get(schema[key][keys.type])(value);

  for (key in record) {
    let value = record[key];

    if (!schema.hasOwnProperty(key)) {
      if (key !== primaryKey)
        delete record[key];
      continue;
    }

    if (schema[key][keys.type])
      record[key] = schema[key][keys.isArray] ?
        (Array.isArray(value) ? value : [value]).map(mapValue) :
        inputMap.get(schema[key][keys.type])(value);
  }

  return record;
}
