import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.micro+json'


run(() => {
  comment('show index')
  return fetchTest('/', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
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
  return fetchTest('/users', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(Object.keys(response.body['@graph']).length,
      3, 'number of records correct')
  })
})


run(() => {
  comment('show individual record with include')
  return fetchTest(`/users/1?${qs.stringify({
    'include': 'spouse,spouse.friends' })}`, {
      method: 'get',
      headers: { 'Accept': mediaType }
    }, response => {
      equal(response.status, 200, 'status is correct')
      equal(response.headers.get('content-type'), mediaType,
        'content type is correct')
      equal(Object.keys(response.body['@graph']).length,
        3, 'number of records correct')
    })
})


run(() => {
  comment('sort a collection and use sparse fields')
  return fetchTest(
  `/users?${qs.stringify({
    'sort': 'birthday,-name',
    'fields[user]': 'name,birthday' })}`, {
      method: 'get',
      headers: { 'Accept': mediaType }
    }, response => {
      equal(response.status, 200, 'status is correct')
      deepEqual(
        response.body['@graph'].map(record => record.name),
        [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
        'sort order is correct')
    })
})


run(() => {
  comment('match on a collection')
  return fetchTest(`/users?${qs.stringify({
    'match[name]': 'John Doe',
    'match[birthday]': '1992-12-07' })}`, {
      method: 'get',
      headers: { 'Accept': mediaType }
    }, response => {
      equal(response.status, 200, 'status is correct')
      deepEqual(
        response.body['@graph'].map(record => record.name).sort(),
        [ 'John Doe' ], 'match is correct')
    })
})


run(() => {
  comment('show related records')
  return fetchTest('/users/2/ownedPets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(Object.keys(response.body['@graph']).length,
      2, 'number of records correct')
  })
})


run(() => {
  comment('find an empty collection')
  return fetchTest(encodeURI('/☯s'), {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    ok(Array.isArray(response.body['@graph']) &&
      !response.body['@graph'].length,
      'payload is empty array')
  })
})


run(() => {
  comment('find a single non-existent record')
  return fetchTest('/users/4', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 404, 'status is correct')
    ok('@error' in response.body, 'error object exists')
    equal(response.body['@error'].name, 'NotFoundError', 'name is correct')
    ok(response.body['@error'].message.length, 'message exists')
  })
})


run(() => {
  comment('find a collection of non-existent related records')
  return fetchTest('/users/3/ownedPets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    ok(Array.isArray(response.body['@graph']) &&
      !response.body['@graph'].length,
      'payload is empty array')
  })
})


run(() => {
  comment('create record')
  return fetchTest('/animals', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
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
  return fetchTest('/user', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
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
  return fetchTest('/users/1', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType }
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
  return fetchTest('/users', {
    method: 'post',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 415, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    ok(response.body['@error'], 'error exists')
  })
})


run(() => {
  comment('update record')
  return fetchTest('/users/2', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
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
  return fetchTest('/animals/3', {
    method: 'delete',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('respond to options: index')
  return fetchTest('/', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: collection')
  return fetchTest('/users', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: IDs')
  return fetchTest('/users/3', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: related')
  return fetchTest('/users/3/ownedPets', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: fail')
  return fetchTest('/foo', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 404, 'status is correct')
  })
})
