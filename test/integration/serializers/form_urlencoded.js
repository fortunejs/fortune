import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import adHoc from
  '../../../lib/serializer/serializers/ad_hoc'
import formUrlEncoded from
  '../../../lib/serializer/serializers/form_urlencoded'


const mediaType = 'application/x-www-form-urlencoded'
const test = httpTest.bind(null, {
  serializers: [ { type: adHoc }, { type: formUrlEncoded } ]
})


run(() => {
  comment('get anything should fail')
  return test('/', {
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 415, 'status is correct')
  })
})


run(() => {
  comment('create records')
  return test(`/animal`, {
    method: 'post',
    headers: { 'Content-Type': mediaType },
    body: qs.stringify({
      name: 'Ayy lmao',
      nicknames: [ 'ayy', 'lmao' ]
    })
  }, response => {
    equal(response.status, 201, 'status is correct')
    ok(~response.headers.get('content-type').indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ], 'response body is correct')
  })
})
