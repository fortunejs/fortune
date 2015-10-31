'use strict'

const tapdance = require('tapdance')
const comment = tapdance.comment
const run = tapdance.run
const equal = tapdance.equal

const httpTest = require('../integration/http_test')

const test = httpTest.bind(null, void 0)


run(() => {
  comment('content negotiation')
  return test('/', {
    headers: { 'Accept': 'text/html' }
  }, response => {
    equal(response.status, 406, 'status is correct')
  })
})
