'use strict'

var testAdapter = require('../../unit/adapter')
var webStorageAdapter = require('../../../lib/adapter/adapters/webstorage')

testAdapter(webStorageAdapter, {
  prefix: 'fortune_test'
})
