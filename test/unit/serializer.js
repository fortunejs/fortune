import { fail, comment, run } from 'tapdance'
import DefaultSerializer from '../../lib/serializer/default'
import * as errors from '../../lib/common/errors'
import { equal, deepEqual } from '../helpers'


const recordTypes = { foo: {}, bar: {} }
const serializer = new DefaultSerializer({ errors, recordTypes })


run(() => {
  comment('show response: no records')

  const context = { response: {} }

  serializer.showResponse(context)

  deepEqual(context.response.payload, [ 'foo', 'bar' ], 'types displayed')
})


run(() => {
  comment('show response: records')

  const context = { response: {} }
  const records = [ 1, 2, 3 ]

  serializer.showResponse(context, records)

  deepEqual(context.response.payload, records, 'records displayed')
})


run(() => {
  comment('show response: records with include')

  const context = { response: {} }
  const records = [ 1, 2, 3 ]
  const include = {
    foo: [ 'a', 'b' ]
  }

  serializer.showResponse(context, records, include)

  deepEqual(context.response.payload, records, 'records displayed')
  deepEqual(context.response.payload.include, include, 'include displayed')
})


run(() => {
  comment('show error')

  const context = { response: {} }
  const error = new TypeError('wtf')

  serializer.showError(context, error)

  equal(context.response.payload.name, 'TypeError', 'error name displayed')
  equal(context.response.payload.message, 'wtf', 'error message displayed')
})


run(() => {
  comment('parse create')

  fail(() =>
    serializer.parseCreate({ request: { ids: [] } }),
    'ids can\'t be specified in ids field')
  fail(() =>
    serializer.parseCreate({ request: { payload: null } }),
    'payload can not be empty')
  deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ], 'return value is correct')
})


run(() => {
  comment('parse update')

  fail(() =>
    serializer.parseCreate({ request: { ids: [] } }),
    'ids can\'t be specified in ids field')
  fail(() =>
    serializer.parseCreate({ request: { payload: null } }),
    'payload can not be empty')
  deepEqual(serializer.parseCreate({ request: { payload: [ 'foo' ] } }),
    [ 'foo' ], 'return value is correct')
})
