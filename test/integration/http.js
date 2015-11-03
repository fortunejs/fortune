'use strict'

const tapdance = require('tapdance')
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const httpTest = require('../integration/http_test')

const test = httpTest.bind(null, void 0)


run(() => {
  comment('content negotiation')
  return test('/', {
    headers: { 'Accept': 'text/html' }
  }, response => {
    ok(response.status === 406, 'status is correct')
  })
})
