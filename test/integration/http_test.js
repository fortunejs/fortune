import { fail } from 'tapdance'
import testInstance from './test_instance'
import http from 'http'
import chalk from 'chalk'
import fortune from '../../lib'
import * as stderr from '../stderr'


const port = 1337


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
