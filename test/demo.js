'use strict'

const http = require('http')
const util = require('util')
const chalk = require('chalk')
const instance = require('./integration/test_instance')
const fortune = require('../lib')

const port = 1337

instance().then(store => {
  store.options.settings.name = 'Foobar'
  store.options.settings.description = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse eleifend tempor vulputate. Etiam rhoncus vulputate leo nec accumsan. Etiam eleifend ultrices faucibus. Vestibulum quis sem neque.`
  store.options.documentation = {
    user: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    name: {
      en: 'Vestibulum vitae velit id tellus vehicula dictum nec at ante. Sed pulvinar eros quis volutpat volutpat. Integer a pulvinar tellus, ut vehicula diam.'
    }
  }

  store.on(fortune.events.change, data => console.log(chalk.cyan(
    `${chalk.bold('Change')}: ${util.inspect(data, { depth: null })}`)))

  const server = http.createServer(fortune.net.http(store))
  server.listen(port, () => console.log(chalk.blue(`Listening on port ${port}...`)))
})
