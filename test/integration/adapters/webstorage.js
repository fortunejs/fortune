'use strict'

var tapdance = require('tapdance')
var testAdapter = require('../../unit/adapter')
var webStorageAdapter = require('../../../lib/adapter/adapters/webstorage')

testAdapter(tapdance, webStorageAdapter, {
  prefix: 'fortune_test'
})
