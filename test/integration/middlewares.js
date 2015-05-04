import Test from 'tape'
import connect from 'connect'
import express from 'express'
import fetch from 'node-fetch'
import Fortune from '../../lib'
import generateApp from './generate_app'
import Serializer from '../../lib/serializer'


// Set promise polyfill for old versions of Node.
fetch.Promise = Promise

const port = 1337
const mediaType = 'application/json'

class DefaultSerializer extends Serializer {
  processResponse (context) {
    const { payload } = context.response
    context.response.payload = new Buffer(JSON.stringify(payload))
    return context
  }
}

DefaultSerializer.id = mediaType

const frameworks = [
  { name: 'express', fn: express},
  { name: 'connect', fn: connect}
]


frameworks.forEach(framework => {
  Test(`${framework.name} integration`, t => {
    let server = framework.fn()
    let app

    generateApp({
      serializers: [{ type: DefaultSerializer }]
    })

    .then(a => {
      app = a

      server.use('/api', Fortune.net.requestListener.bind(app))

      return new Promise((resolve, reject) =>
        server = server.listen(port, error =>
          error ? reject(error) : resolve()))
    })

    .then(() => fetch(`http://localhost:${port}/api/`, {
      headers: {
        'Accept': mediaType
      }
    }))

    .then(response => {
      app.stop()
      server.close()
      return response.json()
    })

    .then(json => {
      t.deepEqual(json.sort(), ['animal', 'user'], 'gets the index')
      t.end()
    })
  })
})
