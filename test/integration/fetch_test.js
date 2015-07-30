import { fail } from 'tapdance'
import testInstance from './test_instance'
import http from 'http'
import chalk from 'chalk'
import fetch from 'node-fetch'
import fortune from '../../lib'
import * as stderr from '../stderr'


const port = 1337

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise


export default (path, request, fn) => {
  let store
  let server

  return testInstance({
    serializers: [
      { type: fortune.serializers.JSONAPI },
      { type: fortune.serializers.MicroAPI,
        options: { obfuscateURIs: false } }
    ]
  })

  .then(instance => {
    store = instance

    const listener = fortune.net.http(store)

    server = http.createServer((request, response) => {
      listener(request, response)
      .catch(error => stderr.error(error))
    })
    .listen(port)

    let headers
    let status

    if (typeof request.body === 'object') {
      request.body = JSON.stringify(request.body)
      if (!request.headers) request.headers = {}
      request.headers['Content-Length'] = request.body.length
    }

    return fetch(`http://localhost:${port}${path}`, request)

    .then(response => {
      server.close()
      stderr.debug(chalk.bold('Response status: ' + response.status))
      stderr.debug(response.headers.raw())
      ; ({ headers, status } = response)
      return store.disconnect().then(() => response.text())
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
    if (store) store.disconnect()
    if (server) server.close()
    fail(error)
  })
}
