import test from 'tape'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'


test('delete record', t => {
  let app
  let methods
  let change

  t.plan(4)

  generateApp(t, {
    serializers: []
  })

  .then(a => {
    app = a
    ; ({ methods, change } = app.dispatcher)

    app.dispatcher.on(change, data => {
      t.ok(arrayProxy.find(data[methods.delete].user, id => id === 3),
        'change event shows deleted ID')
      t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
        [ 1, 2 ], 'change event shows updated IDs')
    })

    return app.dispatch({
      type: 'user',
      method: methods.delete,
      ids: [ 3 ]
    })
  })

  .then(response => {
    t.equal(response.payload.length, 1, 'records deleted')

    return app.dispatch({
      type: 'user',
      method: methods.find,
      ids: [ 1, 2 ]
    })
  })

  .then(response => {
    t.deepEqual(response.payload.map(record =>
      arrayProxy.find(record.friends, id => id === 3)),
      [ undefined, undefined ], 'related records updated')

    return app.stop()
  })

  .then(() => t.end())

  .catch(error => {
    stderr.error.call(t, error)
    app.stop()
    t.fail(error)
    t.end()
  })
})
