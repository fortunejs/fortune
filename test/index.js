var chalk = require('chalk')
var tapdance = require('tapdance')
var comment = tapdance.comment
var run = tapdance.run
var start = Date.now()

// Unit tests.
import './unit/record_type'
import './unit/serializer'

// Integration tests.
import './integration/methods/find'
import './integration/methods/create'
import './integration/methods/update'
import './integration/methods/delete'
import './integration/serializers/json'
import './integration/serializers/form'
import './integration/adapters/memory'
import './integration/http'
import './integration/websocket'

run(function () {
  comment(chalk.yellow('Test finished in ' +
    chalk.bold(Date.now() - start) + ' ms!'))
})
