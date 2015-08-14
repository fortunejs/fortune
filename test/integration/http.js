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


export default function httpTest (options, path, request, fn, change) {
  let store
  let server

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

    if (request && typeof request.body === 'object') {
      request.body = JSON.stringify(request.body)
      if (!request.headers) request.headers = {}
      request.headers['Content-Length'] = Buffer.byteLength(request.body)
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
    if (server) server.close()
    fail(error)
  })
}
