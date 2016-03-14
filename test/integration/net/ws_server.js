'use strict'

const os = require('os')
const cluster = require('cluster')
const fortune = require('../../../lib')
const testInstance = require('../test_instance')

const port = 8890
const workerMap = {}

if (cluster.isMaster) {
  for (let i = 0; i < os.cpus().length; i++) {
    const worker = cluster.fork()
    const workerId = worker.id.toString()
    workerMap[workerId] = worker
    worker.on('message', message => {
      if (message === 'KILL') process.exit()
      for (let id in workerMap) {
          if (id !== workerId) workerMap[id].send(message)
      }
    })
  }
} else {
  testInstance()
  .then(instance => fortune.net.ws(instance, (state, changes) => {
    if (changes) return changes
    if (state.kill) setTimeout(() => process.send('KILL'), 500)
    return state
  }, { port, useIPC: true }))
}
