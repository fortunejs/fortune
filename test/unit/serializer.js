import test from 'tape'
import DefaultSerializer from '../../lib/serializer/default'
import * as errors from '../../lib/common/errors'


const recordTypes = { foo: {}, bar: {} }
const serializer = new DefaultSerializer({ errors, recordTypes })


test('show response: no records', t => {
  const context = { response: {} }

  serializer.showResponse(context)

  t.deepEqual(context.response.payload, [ 'foo', 'bar' ], 'types displayed')
  t.end()
})


test('show response: records', t => {
  const context = { response: {} }
  const records = [ 1, 2, 3 ]

  serializer.showResponse(context, records)

  t.deepEqual(context.response.payload, records, 'records displayed')
  t.end()
})


test('show response: records with include', t => {
  const context = { response: {} }
  const records = [ 1, 2, 3 ]
  const include = {
    foo: [ 'a', 'b' ]
  }

  serializer.showResponse(context, records, include)

  t.deepEqual(context.response.payload, records, 'records displayed')
  t.deepEqual(context.response.payload.include, include, 'include displayed')
  t.end()
})


test('show error', t => {
  const context = { response: {} }
  const error = new TypeError('wtf')

  serializer.showError(context, error)

  t.ok(~context.response.payload.indexOf('TypeError'), 'error name displayed')
  t.ok(~context.response.payload.indexOf('wtf'), 'error message displayed')
  t.end()
})


test('parse create', t => {
  const idsSpecified = () =>
    serializer.parseCreate({ request: { ids: [] } })
  const noRecords = () =>
    serializer.parseCreate({ request: { payload: [] } })

  t.throws(idsSpecified, 'ids can\'t be specified in ids field')
  t.throws(noRecords, 'records must be specified')
  t.deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ], 'return value is correct')
  t.end()
})


test('parse update', t => {
  const idsSpecified = () =>
    serializer.parseCreate({ request: { ids: [] } })
  const noUpdates = () =>
    serializer.parseCreate({ request: { payload: [] } })

  t.throws(idsSpecified, 'ids can\'t be specified in ids field')
  t.throws(noUpdates, 'updates must be specified')
  t.deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ], 'return value is correct')
  t.end()
})
