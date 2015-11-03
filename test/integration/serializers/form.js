'use strict'

const deepEqual = require('deep-equal')
const tapdance = require('tapdance')
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const http = require('http')
const qs = require('querystring')
const FormData = require('form-data')
const httpTest = require('../http_test')
const testInstance = require('../test_instance')
const fortune = require('../../../lib')
const json = require('../../../lib/serializer/serializers/json')
const form = require('../../../lib/serializer/serializers/form')
const formUrlEncoded = form.formUrlEncoded
const formData = form.formData

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
    ok(response.status === 415, 'status is correct')
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
    ok(response.status === 201, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    ok(deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ]), 'response body is correct')
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
    ok(response.status === 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    ok(deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ]), 'response body is correct')
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
    server = http.createServer(fortune.net.http(store)).listen(4000)
  })
  .then(() => new Promise((resolve, reject) =>
    form.submit('http://localhost:4000/animal', (error, response) => error ?
      reject(error) : resolve(response))))
  .then(response => {
    ok(response.statusCode === 201, 'status is correct')
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
    ok(deepEqual(body.map(record => record.name),
      [ 'Ayy lmao' ]), 'name is correct')
    ok(deepEqual(body.map(record => record.picture),
      [ deadbeef.toString('base64') ]), 'picture is correct')
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
    server = http.createServer(fortune.net.http(store)).listen(4001)
  })
  .then(() => new Promise((resolve, reject) =>
    form.submit({
      host: 'localhost',
      port: 4001,
      path: '/animal',
      headers: { 'X-HTTP-Method': 'PATCH' }
    }, (error, response) => error ?
      reject(error) : resolve(response))))
  .then(response => {
    ok(response.statusCode === 200, 'status is correct')
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
    ok(deepEqual(body.map(record => record.name),
      [ 'Ayy lmao' ]), 'name is correct')
    ok(deepEqual(body.map(record => record.picture),
      [ deadbeef.toString('base64') ]), 'picture is correct')
    store.disconnect()
    server.close()
  })
})
