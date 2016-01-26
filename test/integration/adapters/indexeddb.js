'use strict'

var tapdance = require('tapdance')
var testAdapter = require('../../unit/adapter')
var indexeddbAdapter = require('../../../lib/adapter/adapters/indexeddb')

testAdapter(tapdance, indexeddbAdapter, {
  name: 'fortune_test'
})
