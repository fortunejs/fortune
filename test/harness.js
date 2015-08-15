// Entry point for test harness.

/* eslint-disable func-names, no-var */
module.exports = [
  require('tapdance'),
  require('../dist/test/helpers')
].reduce(function (memo, object) {
  var name
  for (name in object) memo[name] = object[name]
  return memo
}, {})
