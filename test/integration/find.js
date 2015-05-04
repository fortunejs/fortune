import Test from 'tape'
import Serializer from '../../lib/serializer'
import generateApp from './generate_app'
import * as stderr from '../stderr'


class DefaultSerializer extends Serializer {}
DefaultSerializer.id = Symbol()


Test('get index', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id
}))

.then(response => {
  t.deepEqual(response.payload.sort(), ['animal', 'user'], 'gets the index')
  t.end()
})

.catch(error => {
  stderr.error(error)
  t.fail(error)
}))


Test('get collection', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id,
  type: 'user'
}))

.then(response => {
  t.equal(response.payload.records.length, 3, 'gets all records')
  t.end()
})

.catch(error => {
  stderr.error(error)
  t.fail(error)
}))


Test('get IDs', t => generateApp({
  serializers: [{ type: DefaultSerializer }]
})

.then(app => app.dispatcher.request({
  serializerOutput: DefaultSerializer.id,
  type: 'user',
  ids: [ 2, 1 ]
}))

.then(response => {
  t.deepEqual(response.payload.records
    .map(record => record.id).sort((a, b) => a - b),
    [ 1, 2 ], 'gets records with IDs')
  t.end()
})

.catch(error => {
  stderr.error(error)
  t.fail(error)
}))
