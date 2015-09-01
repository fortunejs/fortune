import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import json from '../../../lib/serializer/serializers/json'


const test = httpTest.bind(null, {
  serializers: [ { type: json } ]
})


run(() => {
  comment('get index')
  return test('/', null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body, [ 'user', 'animal', '☯' ],
      'response body is correct')
  })
})


run(() => {
  comment('get empty collection')
  return test(encodeURI('/☯'), null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body, [], 'response body is correct')
  })
})


run(() => {
  comment('get records')
  return test('/user', null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    equal(response.body.length, 3, 'response body is correct')
  })
})


run(() => {
  comment('get records by ID')
  return test('/animal/1,%2Fwtf', null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.id),
      [ 1, '/wtf' ], 'response body is correct')
  })
})


run(() => {
  comment('get records with fields')
  return test(`/animal?${qs.stringify({
    fields: 'name,owner'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => Object.keys(record).length),
      [ 4, 4, 4, 4 ], 'response body fields are correct')
  })
})


run(() => {
  comment('get records with match')
  return test(`/animal?${qs.stringify({
    'match[name]': 'Fido'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    equal(response.body[0].name, 'Fido', 'match is correct')
  })
})


run(() => {
  comment('get records with sort/limit/offset')
  return test(`/animal?${qs.stringify({
    sort: 'name',
    limit: 2,
    offset: 1
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Fido', 'Sniffles' ], 'response body is correct')
  })
})


run(() => {
  comment('create records')
  return test(`/animal`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: [ {
      name: 'Ayy lmao',
      nicknames: [ 'ayy', 'lmao' ],
      owner: 1
    } ]
  }, response => {
    equal(response.status, 201, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ], 'response body is correct')
  })
})


run(() => {
  comment('update records')
  return test(`/animal`, {
    method: 'patch',
    headers: { 'Content-Type': 'application/json' },
    body: [ {
      id: '/wtf',
      replace: { name: 'Ayy lmao' }
    } ]
  }, response => {
    equal(response.status, 200, 'status is correct')
    ok(~response.headers['content-type'].indexOf('application/json'),
      'content type is correct')
    deepEqual(response.body.map(record => record.name),
      [ 'Ayy lmao' ], 'response body is correct')
  })
})


run(() => {
  comment('delete records')
  return test(`/animal/1,%2Fwtf`, {
    method: 'delete'
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})
