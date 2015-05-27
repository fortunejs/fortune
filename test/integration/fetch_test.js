import generateApp from './generate_app'
import http from 'http'
import chalk from 'chalk'
import fetch from 'node-fetch'
import fortune from '../../lib'
import * as stderr from '../stderr'


const port = 1337

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise


export default (t, path, request, fn) => {
  let app
  let server

  return generateApp()

  .then(a => {
    app = a

    server = http.createServer(function listener () {
      fortune.net.http.call(app, ...arguments)
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

    return fetch(encodeURI(`http:\/\/localhost:${port}${path}`), request)

    .then(response => {
      server.close()
      stderr.debug(chalk.bold(response.status), response.headers.raw())
      ; ({ headers, status } = response)
      return app.stop().then(() => response.text())
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
      }

      return fn({
        status,
        headers,
        body: text
      })
    })

    .then(t.end)
  })

  .catch(error => {
    stderr.error(error)
    if (app) app.stop()
    if (server) server.close()
    t.fail(error)
    t.end()
  })
}
