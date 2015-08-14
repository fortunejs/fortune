import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import microApi from '../../../lib/serializer/serializers/micro_api'


const mediaType = 'application/vnd.micro+json'
const test = httpTest.bind(null, {
  serializers: [ { type: microApi, options: { obfuscateURIs: false } } ]
})


run(() => {
  comment('show index')
  return test('/', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(Object.keys(response.body['@links']).length,
      3, 'number of types correct')
    ok(!response.body['@links'].user.enemies['@inverse'],
      'denormalized inverse is missing')
  })
})


run(() => {
  comment('show collection')
  return test('/users', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body['@graph'].length,
      3, 'number of records correct')
  })
})


run(() => {
  comment('show individual record with include')
  return test(`/users/1?${qs.stringify({
    'include': 'spouse,spouse.friends'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body['@graph'].length,
      3, 'number of records correct')
  })
})


run(() => {
  comment('show individual record with encoded ID')
  return test(`/animals/%2Fwtf?${qs.stringify({
    'fields[animal]': 'birthday,type'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body['@graph'].length,
      1, 'number of records correct')
    equal(Object.keys(response.body['@graph'][0]).length,
      6, 'number of fields correct')
  })
})


run(() => {
  comment('sort a collection and use sparse fields')
  return test(
  `/users?${qs.stringify({
    'sort': 'birthday,-name',
    'fields[user]': 'name,birthday'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    deepEqual(
      response.body['@graph'].map(record => record.name),
      [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
      'sort order is correct')
  })
})


run(() => {
  comment('match on a collection')
  return test(`/users?${qs.stringify({
    'match[name]': 'John Doe',
    'match[birthday]': '1992-12-07'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    deepEqual(
      response.body['@graph'].map(record => record.name).sort(),
      [ 'John Doe' ], 'match is correct')
  })
})


run(() => {
  comment('show related records')
  return test('/users/2/ownedPets', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body['@graph'].length,
      2, 'number of records correct')
  })
})


run(() => {
  comment('find an empty collection')
  return test(encodeURI('/☯s'), null, response => {
    equal(response.status, 200, 'status is correct')
    ok(Array.isArray(response.body['@graph']) &&
      !response.body['@graph'].length,
      'payload is empty array')
  })
})


run(() => {
  comment('find a single non-existent record')
  return test('/users/4', null, response => {
    equal(response.status, 404, 'status is correct')
    ok('@error' in response.body, 'error object exists')
    equal(response.body['@error'].name, 'NotFoundError', 'name is correct')
    ok(response.body['@error'].message.length, 'message exists')
  })
})


run(() => {
  comment('find a collection of non-existent related records')
  return test('/users/3/ownedPets', null, response => {
    equal(response.status, 200, 'status is correct')
    ok(Array.isArray(response.body['@graph']) &&
      !response.body['@graph'].length,
      'payload is empty array')
  })
})


run(() => {
  comment('create record')
  return test('/animals', {
    method: 'post',
    headers: { 'Content-Type': mediaType },
    body: {
      '@graph': [ {
        '@type': 'animal',
        name: 'Rover',
        birthday: new Date().toJSON(),
        picture: new Buffer('This is a string.').toString('base64'),
        owner: { 'id': 1 }
      } ]
    }
  }, response => {
    equal(response.status, 201, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.headers.get('location'), response.body['@graph'][0]
      ['@id'], 'location header is correct')
    ok(response.body['@graph'][0]['@type'], 'type is correct')
    equal(response.body['@graph'][0].owner.id, 1, 'link is correct')
    equal(new Buffer(response.body['@graph'][0].picture, 'base64')
      .toString(), 'This is a string.', 'buffer is correct')
    ok(Date.now() - new Date(response.body['@graph'][0].birthday)
      .getTime() < 60 * 1000, 'date is close enough')
  }, (change, methods) => {
    ok(change[methods.create].animal[0], 'created ID exists')
  })
})


run(() => {
  comment('create record with existing ID should fail')
  return test('/user', {
    method: 'post',
    headers: { 'Content-Type': mediaType },
    body: {
      '@graph': [ { '@type': 'user', id: 1 } ]
    }
  }, response => {
    equal(response.status, 409, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    ok(response.body['@error'], 'error exists')
  })
})


run(() => {
  comment('create record on wrong route should fail')
  return test('/users/1', {
    method: 'post',
    headers: { 'Content-Type': mediaType }
  }, response => {
    equal(response.status, 405, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
    ok(response.body['@error'], 'error exists')
  })
})


run(() => {
  comment('create record with wrong type should fail')
  return test('/users', { method: 'post' }, response => {
    equal(response.status, 415, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    ok(response.body['@error'], 'error exists')
  })
})


run(() => {
  comment('update record')
  return test('/users/2', {
    method: 'patch',
    headers: { 'Content-Type': mediaType },
    body: {
      '@graph': [ {
        '@type': 'user',
        id: 2,
        name: 'Jenny Death',
        spouse: { id: 3 },
        enemies: { id: [ 3 ] },
        friends: { id: [ 1, 3 ] }
      } ]
    }
  }, response => {
    equal(response.status, 200, 'status is correct')
    ok(Math.abs(new Date(response.body['@graph'][0].lastModified).getTime() -
      Date.now()) < 5 * 1000, 'update modifier is correct')
  })
})


run(() => {
  comment('delete a single record')
  return test('/animals/3', { method: 'delete' }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('respond to options: index')
  return test('/', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: collection')
  return test('/users', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: IDs')
  return test('/users/3', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: related')
  return test('/users/3/ownedPets', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: fail')
  return test('/foo', { method: 'options' }, response => {
    equal(response.status, 404, 'status is correct')
  })
})
