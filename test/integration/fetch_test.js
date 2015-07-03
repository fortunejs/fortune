import testInstance from './test_instance'
import http from 'http'
import chalk from 'chalk'
import fetch from 'node-fetch'
import fortune from '../../lib'
import * as stderr from '../stderr'


const port = 1337

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise


export default (path, request, fn) => arg => {
  let store
  let server

  const t = arg

  return testInstance(t)

  .then(instance => {
    store = instance

    const listener = fortune.net.http(store)

    server = http.createServer((request, response) => {
      listener(request, response)
      .catch(error => stderr.error.call(t, error))
    })
    .listen(port)

    let headers
    let status

    if (typeof request.body === 'object') {
      request.body = JSON.stringify(request.body)
      if (!request.headers) request.headers = {}
      request.headers['Content-Length'] = request.body.length
    }

    return fetch(encodeURI(`http://localhost:${port}${path}`), request)

    .then(response => {
      server.close()
      stderr.debug.call(t, chalk.bold('Response status: ' + response.status),
        response.headers.raw())
      ; ({ headers, status } = response)
      return store.disconnect().then(() => response.text())
    })

    .then(text => {
      try {
        if (text.length) {
          text = JSON.parse(text)
          stderr.log.call(t, text)
        }
      }
      catch (error) {
        stderr.warn.call(t, `Failed to parse JSON.`)
        stderr.log.call(t, text)
      }

      return fn(t, {
        status,
        headers,
        body: text
      })
    })

    .then(t.end)
  })

  .catch(error => {
    stderr.error.call(t, error)
    if (store) store.disconnect()
    if (server) server.close()
    t.fail(error)
    t.end()
  })
}
