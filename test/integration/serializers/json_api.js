import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import fetchTest from '../fetch_test'


const mediaType = 'application/vnd.api+json'


run(() => {
  comment('get ad-hoc index')
  return fetchTest('/', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
  })
})


run(() => {
  comment('create record')
  return fetchTest('/animals', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        id: 4,
        type: 'animal',
        attributes: {
          name: 'Rover',
          type: 'Chihuahua',
          birthday: new Date().toJSON(),
          picture: new Buffer('This is a string.').toString('base64'),
          'favorite-food': 'Bacon'
        },
        relationships: {
          owner: {
            data: { type: 'users', id: 1 }
          }
        }
      }
    }
  }, response => {
    equal(response.status, 201, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.headers.get('location'), '/animals/4',
      'location header looks right')
    equal(response.body.data.type, 'animals', 'type is correct')
    equal(response.body.data.attributes['favorite-food'], 'Bacon',
      'inflected key value is correct')
    equal(new Buffer(response.body.data.attributes.picture, 'base64')
      .toString(), 'This is a string.', 'buffer is correct')
    ok(Date.now() - new Date(response.body.data.attributes.birthday)
      .getTime() < 60 * 1000, 'date is close enough')
  })
})


run(() => {
  comment('create record with existing ID should fail')
  return fetchTest('/users', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        id: 1,
        type: 'user'
      }
    }
  }, response => {
    equal(response.status, 409, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body.errors.length, 1, 'error is correct')
  })
})


run(() => {
  comment('create record with wrong route should fail')
  return fetchTest('/users/4', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType }
  }, response => {
    equal(response.status, 405, 'status is correct')
    equal(response.headers.get('allow'), 'GET, PATCH, DELETE',
      'allow header is correct')
    equal(response.body.errors.length, 1, 'error exists')
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
    equal(response.body.errors.length, 1, 'error exists')
  })
})


run(() => {
  comment('update record')
  return fetchTest('/users/2', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: {
        id: 2,
        type: 'users',
        attributes: {
          name: 'Jenny Death',
          'camel-case-field': 'foobar'
        },
        relationships: {
          spouse: {
            data: { type: 'users', id: 3 }
          },
          'owned-pets': {
            data: [
              { type: 'animals', id: 3 }
            ]
          },
          enemies: {
            data: [
              { type: 'users', id: 3 }
            ]
          },
          friends: {
            data: [
              { type: 'users', id: 1 },
              { type: 'users', id: 3 }
            ]
          }
        }
      }
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
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
      equal(response.body.links.self, '/users', 'link is correct')
      deepEqual(
        response.body.data.map(record => record.attributes.name),
        [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
        'sort order is correct')
    })
})


run(() => {
  comment('filter a collection')
  return fetchTest(`/users?${qs.stringify({
    'filter[name]': 'John Doe',
    'filter[birthday]': '1992-12-07' })}`, {
      method: 'get',
      headers: { 'Accept': mediaType }
    }, response => {
      equal(response.status, 200, 'status is correct')
      equal(response.body.links.self, '/users', 'link is correct')
      deepEqual(
        response.body.data.map(record => record.attributes.name).sort(),
        [ 'John Doe' ], 'match is correct')
    })
})


run(() => {
  comment('dasherizes the camel cased fields')
  return fetchTest('/users/1', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.body.data.attributes['camel-case-field'],
      'Something with a camel case field', 'camel case field is correct')
  })
})


run(() => {
  comment('find a single record with include')
  return fetchTest(
    `/animals/1?${qs.stringify({ include: 'owner.friends' })}`, {
      method: 'get',
      headers: { 'Accept': mediaType }
    }, response => {
      equal(response.status, 200, 'status is correct')
      equal(response.body.links.self, '/animals/1', 'link is correct')
      equal(response.body.data.id, '1', 'id is correct')
      deepEqual(response.body.included.map(record => record.type),
        [ 'users', 'users' ], 'type is correct')
      deepEqual(response.body.included.map(record => record.id)
        .sort((a, b) => a - b), [ '1', '3' ], 'id is correct')
    })
})


run(() => {
  comment('find a single non-existent record')
  return fetchTest('/animals/404', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 404, 'status is correct')
    ok('errors' in response.body, 'errors object exists')
    equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
    ok(response.body.errors[0].detail.length, 'detail exists')
  })
})


run(() => {
  comment('delete a single record')
  return fetchTest('/animals/2', {
    method: 'delete',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('find a singular related record')
  return fetchTest('/users/2/spouse', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/spouse', 'link is correct')
    ok(!Array.isArray(response.body.data), 'data type is correct')
  })
})


run(() => {
  comment('find a plural related record')
  return fetchTest('/users/2/owned-pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/owned-pets', 'link is correct')
    ok(response.body.data.length === 2, 'data length is correct')
  })
})


run(() => {
  comment('find a collection of non-existent related records')
  return fetchTest('/users/3/owned-pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/owned-pets', 'link is correct')
    ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  })
})


run(() => {
  comment('find an empty collection')
  return fetchTest(encodeURI('/☯s'), {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self,
      encodeURI('/☯s'), 'link is correct')
    ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  })
})


run(() => {
  comment('get an array relationship entity')
  return fetchTest('/users/2/relationships/owned-pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/relationships/owned-pets',
      'link is correct')
    deepEqual(response.body.data.map(data => data.id), [ 2, 3 ],
      'ids are correct')
  })
})


run(() => {
  comment('get an empty array relationship entity')
  return fetchTest('/users/3/relationships/owned-pets', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/relationships/owned-pets',
      'link is correct')
    deepEqual(response.body.data, [], 'data is correct')
  })
})


run(() => {
  comment('get a singular relationship entity')
  return fetchTest('/users/1/relationships/spouse', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/1/relationships/spouse',
      'link is correct')
    equal(response.body.data.type, 'users', 'type is correct')
    equal(response.body.data.id, 2, 'id is correct')
  })
})


run(() => {
  comment('get an empty singular relationship entity')
  return fetchTest('/users/3/relationships/spouse', {
    method: 'get',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/relationships/spouse',
      'link is correct')
    equal(response.body.data, null, 'data is correct')
  })
})


run(() => {
  comment('update a singular relationship entity')
  return fetchTest('/users/2/relationships/spouse', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: { type: 'users', id: 3 }
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('update an array relationship entity')
  return fetchTest('/users/1/relationships/owned-pets', {
    method: 'patch',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animals', id: 2 } ]
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('post to an array relationship entity')
  return fetchTest('/users/1/relationships/owned-pets', {
    method: 'post',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animals', id: 2 } ]
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('delete from an array relationship entity')
  return fetchTest('/users/1/relationships/friends', {
    method: 'delete',
    headers: { 'Accept': mediaType, 'Content-Type': mediaType },
    body: {
      data: [ { type: 'users', id: 3 } ]
    }
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
  return fetchTest('/animals', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: individual')
  return fetchTest('/animals/1', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: link')
  return fetchTest('/animals/1/owner', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: relationships')
  return fetchTest('/animals/1/relationships/owner', {
    method: 'options',
    headers: { 'Accept': mediaType }
  }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST, PATCH, DELETE', 'allow header is correct')
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
