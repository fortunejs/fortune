'use strict'

module.exports = {
  // Keys
  constants: require('./constants'),
  keys: require('./keys'),
  events: require('./events'),
  methods: require('./methods'),

  // Utility functions
  assign: require('./assign'),
  castToNumber: require('./cast_to_number'),
  castValue: require('./cast_value'),
  clone: require('./clone'),
  deepEqual: require('./deep_equal'),
  generateId: require('./generate_id'),
  applyUpdate: require('./apply_update'),

  // i18n
  message: require('./message'),

  // Typed responses
  responses: require('./response_classes'),
  errors: require('./errors'),
  successes: require('./success'),

  // Arrays
  filter: require('./array/filter'),
  find: require('./array/find'),
  includes: require('./array/includes'),
  map: require('./array/map'),
  pull: require('./array/pull'),
  reduce: require('./array/reduce'),
  unique: require('./array/unique')
}
