import generateApp from './generate_app'
import http from 'http'
import chalk from 'chalk'
import fetch from 'node-fetch'
import Fortune from '../../lib'
import * as stderr from '../stderr'


const port = 1337

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise


export default (path, request) => {
  let app

  return generateApp().then(a => {
    app = a

    const listener = Fortune.net.requestListener.bind(app)
    const server = http.createServer(listener).listen(port)
    let headers, status

    return fetch(`http:\/\/localhost:${port}${path}`, Object.assign({}, request,
      typeof request.body === 'object' ? {
        body: JSON.stringify(request.body)
      } : null))

    .then(response => {
      server.close()
      stderr.debug(chalk.bold(response.status), response.headers.raw())
      ;({ headers, status } = response)
      return response.json()
    })

    .then(json => {
      stderr.log(json)
      return app.stop().then(() => ({
        status,
        headers,
        body: json
      }))
    })

    .catch(error => {
      stderr.error(error)
      return null
    })
  })
}
