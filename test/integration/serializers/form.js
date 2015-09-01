import http from 'http'
import qs from 'querystring'
import FormData from 'form-data'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import adHoc from
  '../../../lib/serializer/serializers/ad_hoc'
import { formUrlEncoded, formData } from
  '../../../lib/serializer/serializers/form'
import testInstance from '../test_instance'
import fortune from '../../../lib'


const formUrlEncodedType = 'application/x-www-form-urlencoded'
const options = {
  serializers: [
    { type: adHoc },
    { type: formUrlEncoded },
    { type: formData }
  ]
}
const test = httpTest.bind(null, options)


run(() => {
  comment('get anything should fail')
  return test('/', {
    headers: { 'Accept': formUrlEncodedType }
  }, response => {
    equal(response.status, 415, 'status is correct')
  })
})


run(() => {
  comment('create records using urlencoded data')
  return test(`/animal`, {
    method: 'post',
    headers: { 'Content-Type': formUrlEncodedType },
    body: qs.stringify({
      name: 'Ayy lmao',
      nicknames: [ 'ayy', 'lmao' ]
    })
  }, response => {
    equal(response.status, 201, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ], 'response body is correct')
  })
})


run(() => {
  comment('create records using form data')

  const deadbeef = new Buffer('deadbeef', 'hex')
  const form = new FormData()
  form.append('name', 'Ayy lmao')
  form.append('picture', deadbeef,
    { filename: 'deadbeef.dump' })

  return testInstance(options)
  .then(store => http.createServer(fortune.net.http(store)).listen(1337))
  .then(() => new Promise((resolve, reject) =>
    form.submit('http://localhost:1337/animal', (error, response) => error ?
      reject(error) : resolve(response))))
  .then(response => {
    equal(response.statusCode, 201, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')

    return new Promise(resolve => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    })
  })
  .then(payload => {
    const body = JSON.parse(payload.toString())
    deepEqual(body.map(record => record.name),
      [ 'Ayy lmao' ], 'name is correct')
    deepEqual(body.map(record => record.picture),
      [ deadbeef.toString('base64') ], 'picture is correct')
  })
})
