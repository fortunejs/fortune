'use strict'

const tapdance = require('tapdance')
const fail = tapdance.fail

const testInstance = require('./test_instance')
const http = require('http')
const chalk = require('chalk')
const fortune = require('../../lib')
const stderr = require('../stderr')

let i = 0


module.exports = function httpTest (options, path, request, fn, change) {
  let store
  let server
  let port = 1024 + i

  i++
  if (port >= 65535) i = 0

  return testInstance(options)

  .then(instance => {
    store = instance

    if (typeof change === 'function')
      store.on(fortune.change, data => change(data, fortune.methods))

    const listener = fortune.net.http(store)

    server = http.createServer((request, response) => {
      listener(request, response)
      .catch(error => stderr.error(error))
    })
    .listen(port)

    let headers
    let status

    if (request) {
      if (!request.headers) request.headers = {}
      if (typeof request.body === 'object') {
        request.body = JSON.stringify(request.body)
        request.headers['Content-Length'] = Buffer.byteLength(request.body)
      }
    }

    return new Promise((resolve, reject) =>
      http.request(Object.assign({ port, path }, request), response => {
        headers = response.headers
        status = response.statusCode

        const chunks = []

        response.on('error', reject)
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
      }).end(request ? request.body : null))

    .then(response => {
      server.close()
      stderr.debug(chalk.bold('Response status: ' + status))
      stderr.debug(headers)
      return store.disconnect().then(() => response.toString())
    })

    .then(text => {
      try {
        if (text.length) {
          text = JSON.parse(text)
          stderr.log(text)
        }
      }
      catch (error) {
        stderr.warn(`Failed to parse JSON.`)
        stderr.log(text)
      }

      return fn({
        status,
        headers,
        body: text
      })
    })
  })

  .catch(error => {
    stderr.error(error)
    if (server) server.close()
    fail(error)
  })
}
