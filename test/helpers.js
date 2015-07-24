import assert from 'assert'
import { pass, fail } from 'tapdance'


export function ok (expression, message) {
  pass(() => assert(expression), message)
}


export function notOk (expression, message) {
  fail(() => assert(expression), message)
}


export function equal (a, b, message) {
  pass(() => assert.equal(a, b), message)
}


export function deepEqual (a, b, message) {
  pass(() => assert.deepEqual(a, b), message)
}
