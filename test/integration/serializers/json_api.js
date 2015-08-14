import qs from 'querystring'
import { run, comment } from 'tapdance'
import { ok, deepEqual, equal } from '../../helpers'
import httpTest from '../http'
import jsonApi from '../../../lib/serializer/serializers/json_api'


const mediaType = 'application/vnd.api+json'
const test = httpTest.bind(null, {
  serializers: [ { type: jsonApi } ]
})


run(() => {
  comment('get ad-hoc index')
  return test('/', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
  })
})


run(() => {
  comment('create record')
  return test('/animals', {
    method: 'post',
    headers: { 'Content-Type': mediaType },
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
  return test('/users', {
    method: 'post',
    headers: { 'Content-Type': mediaType },
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
  return test('/users/4', {
    method: 'post',
    headers: { 'Content-Type': mediaType }
  }, response => {
    equal(response.status, 405, 'status is correct')
    equal(response.headers.get('allow'), 'GET, PATCH, DELETE',
      'allow header is correct')
    equal(response.body.errors.length, 1, 'error exists')
  })
})


run(() => {
  comment('create record with wrong type should fail')
  return test('/users', { method: 'post' }, response => {
    equal(response.status, 415, 'status is correct')
    equal(response.headers.get('content-type'), mediaType,
      'content type is correct')
    equal(response.body.errors.length, 1, 'error exists')
  })
})


run(() => {
  comment('update record')
  return test('/users/2', {
    method: 'patch',
    headers: { 'Content-Type': mediaType },
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
    equal(response.status, 200, 'status is correct')
    ok(Math.abs(new Date(response.body.data.attributes['last-modified'])
      .getTime() - Date.now()) < 5 * 1000, 'update modifier is correct')
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
    equal(response.body.links.self, '/users', 'link is correct')
    deepEqual(
      response.body.data.map(record => record.attributes.name),
      [ 'John Doe', 'Microsoft Bob', 'Jane Doe' ],
      'sort order is correct')
  })
})


run(() => {
  comment('filter a collection')
  return test(`/users?${qs.stringify({
    'filter[name]': 'John Doe',
    'filter[birthday]': '1992-12-07'
  })}`, null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users', 'link is correct')
    deepEqual(
      response.body.data.map(record => record.attributes.name).sort(),
      [ 'John Doe' ], 'match is correct')
  })
})


run(() => {
  comment('dasherizes the camel cased fields')
  return test('/users/1', null, response => {
    equal(response.body.data.attributes['camel-case-field'],
      'Something with a camel case field.', 'camel case field is correct')
  })
})


run(() => {
  comment('find a single record with include')
  return test(
    `/animals/1?${qs.stringify({ include: 'owner.friends' })}`,
  null, response => {
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
  comment('show individual record with encoded ID')
  return test(`/animals/%2Fwtf`, null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/animals/%2Fwtf', 'link is correct')
    equal(response.body.data.id, '/wtf', 'id is correct')
  })
})


run(() => {
  comment('find a single non-existent record')
  return test('/animals/404', null, response => {
    equal(response.status, 404, 'status is correct')
    ok('errors' in response.body, 'errors object exists')
    equal(response.body.errors[0].title, 'NotFoundError', 'title is correct')
    ok(response.body.errors[0].detail.length, 'detail exists')
  })
})


run(() => {
  comment('delete a single record')
  return test('/animals/2', { method: 'delete' }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('find a singular related record')
  return test('/users/2/spouse', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/spouse', 'link is correct')
    ok(!Array.isArray(response.body.data), 'data type is correct')
  })
})


run(() => {
  comment('find a plural related record')
  return test('/users/2/owned-pets', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/owned-pets', 'link is correct')
    ok(response.body.data.length === 2, 'data length is correct')
  })
})


run(() => {
  comment('find a collection of non-existent related records')
  return test('/users/3/owned-pets', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/owned-pets', 'link is correct')
    ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  })
})


run(() => {
  comment('find an empty collection')
  return test(encodeURI('/☯s'), null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self,
      encodeURI('/☯s'), 'link is correct')
    ok(Array.isArray(response.body.data) && !response.body.data.length,
      'data is empty array')
  })
})


run(() => {
  comment('get an array relationship entity')
  return test('/users/2/relationships/owned-pets', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/2/relationships/owned-pets',
      'link is correct')
    deepEqual(response.body.data.map(data => data.id), [ 2, 3 ],
      'ids are correct')
  })
})


run(() => {
  comment('get an empty array relationship entity')
  return test('/users/3/relationships/owned-pets', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/relationships/owned-pets',
      'link is correct')
    deepEqual(response.body.data, [], 'data is correct')
  })
})


run(() => {
  comment('get a singular relationship entity')
  return test('/users/1/relationships/spouse', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/1/relationships/spouse',
      'link is correct')
    equal(response.body.data.type, 'users', 'type is correct')
    equal(response.body.data.id, 2, 'id is correct')
  })
})


run(() => {
  comment('get an empty singular relationship entity')
  return test('/users/3/relationships/spouse', null, response => {
    equal(response.status, 200, 'status is correct')
    equal(response.body.links.self, '/users/3/relationships/spouse',
      'link is correct')
    equal(response.body.data, null, 'data is correct')
  })
})


run(() => {
  comment('update a singular relationship entity')
  return test('/users/2/relationships/spouse', {
    method: 'patch',
    headers: { 'Content-Type': mediaType },
    body: {
      data: { type: 'users', id: 3 }
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('update an array relationship entity')
  return test('/users/1/relationships/owned-pets', {
    method: 'patch',
    headers: { 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animals', id: 2 } ]
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('post to an array relationship entity')
  return test('/users/1/relationships/owned-pets', {
    method: 'post',
    headers: { 'Content-Type': mediaType },
    body: {
      data: [ { type: 'animals', id: 2 } ]
    }
  }, response => {
    equal(response.status, 204, 'status is correct')
  })
})


run(() => {
  comment('delete from an array relationship entity')
  return test('/users/1/relationships/friends', {
    method: 'delete',
    headers: { 'Content-Type': mediaType },
    body: {
      data: [ { type: 'users', id: 3 } ]
    }
  }, response => {
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
  return test('/animals', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: individual')
  return test('/animals/1', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: link')
  return test('/animals/1/owner', { method: 'options' }, response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: relationships')
  return test('/animals/1/relationships/owner', { method: 'options' },
  response => {
    equal(response.status, 204, 'status is correct')
    equal(response.headers.get('allow'),
      'GET, POST, PATCH, DELETE', 'allow header is correct')
  })
})


run(() => {
  comment('respond to options: fail')
  return test('/foo', { method: 'options' }, response => {
    equal(response.status, 404, 'status is correct')
  })
})
