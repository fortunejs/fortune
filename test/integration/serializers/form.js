import http from 'http'
import qs from 'querystring'
import FormData from 'form-data'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import json from
  '../../../lib/serializer/serializers/json'
import { formUrlEncoded, formData } from
  '../../../lib/serializer/serializers/form'
import testInstance from '../test_instance'
import fortune from '../../../lib'


const options = {
  serializers: [
    { type: json },
    { type: formUrlEncoded },
    { type: formData }
  ]
}

const test = httpTest.bind(null, options)


run(() => {
  comment('get anything should fail')
  return test('/', {
    headers: { 'Accept': 'application/x-www-form-urlencoded' }
  }, response => {
    equal(response.status, 415, 'status is correct')
  })
})


run(() => {
  comment('create records using urlencoded data')
  return test(`/animal`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  comment('update records using urlencoded data')
  return test(`/animal`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-HTTP-Method': 'PATCH'
    },
    body: qs.stringify({
      id: 1,
      name: 'Ayy lmao',
      nicknames: [ 'ayy', 'lmao' ]
    })
  }, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ], 'response body is correct')
  })
})


run(() => {
  comment('create records using form data')

  let server
  let store
  const deadbeef = new Buffer('deadbeef', 'hex')
  const form = new FormData()
  form.append('name', 'Ayy lmao')
  form.append('picture', deadbeef,
    { filename: 'deadbeef.dump' })

  return testInstance(options)
  .then(s => {
    store = s
    server = http.createServer(fortune.net.http(store)).listen(1337)
  })
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
    store.disconnect()
    server.close()
  })
})


run(() => {
  comment('update records using form data')

  let server
  let store
  const deadbeef = new Buffer('deadbeef', 'hex')
  const form = new FormData()
  form.append('id', 1)
  form.append('name', 'Ayy lmao')
  form.append('picture', deadbeef,
    { filename: 'deadbeef.dump' })

  return testInstance(options)
  .then(s => {
    store = s
    server = http.createServer(fortune.net.http(store)).listen(1337)
  })
  .then(() => new Promise((resolve, reject) =>
    form.submit({
      host: 'localhost',
      port: 1337,
      path: '/animal',
      headers: { 'X-HTTP-Method': 'PATCH' }
    }, (error, response) => error ?
      reject(error) : resolve(response))))
  .then(response => {
    equal(response.statusCode, 200, 'status is correct')
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
    store.disconnect()
    server.close()
  })
})
