'use strict'

const fortune = require('../../../lib')
const testInstance = require('../test_instance')

const port = 8890

testInstance()
.then(instance => fortune.net.ws(instance, (state, changes) => {
  if (changes) return changes
  if (state.kill) process.exit(0)
  return state
}, { port }))
