import generateApp from './generate_app'
import http from 'http'
import chalk from 'chalk'
import fetch from 'node-fetch'
import Fortune from '../../lib'
import * as stderr from '../../lib/common/stderr'


const PORT = 1337

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise


export default (path, request, fn) => {
  generateApp().then(app => {
    const listener = Fortune.net.requestListener.bind(app, {})
    const server = http.createServer(listener).listen(PORT)

    fetch(`http:\/\/localhost:${PORT}${path}`, Object.assign({}, request,
      typeof request.body === 'object' ? {
        body: JSON.stringify(request.body)
      } : null))
      .then(response => {
        server.close()
        if (!process.env.REPORTER)
          stderr.debug(chalk.bold(response.status), response.headers.raw())
        return response.json()
      }).then(json => {
        if (!process.env.REPORTER)
          stderr.log(json)
        fn(json)
      }, error => {
        if (!process.env.REPORTER)
          stderr.error(error)
      })
  })
}
