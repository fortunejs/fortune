import test from 'tape'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'
import * as keys from '../../../lib/common/keys'


test('update one to one with 2nd degree unset', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 3,
      replace: { spouse: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).spouse, null,
      '2nd degree related field unset')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).spouse, 3,
      'related field set')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).spouse, 2,
      'field updated')
  }
}))


test('update one to one with former related record', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      replace: { spouse: 3 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).spouse, null,
      'related field unset')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).spouse, 3,
      'field updated')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).spouse, 2,
      'related field set')
  }
}))


test('update one to one with same value', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      replace: { spouse: 1 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).spouse, 2,
      'related field is same')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).spouse, 1,
      'field is same')
  }
}))


test('update one to one with null value', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      replace: { spouse: null }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).spouse, null,
      'related field is updated')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).spouse, null,
      'field is updated')
  }
}))


test('update one to many (set)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [
    {
      [keys.primary]: 1,
      replace: { owner: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).pets.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'related field pushed')
  }
}))


test('update one to many (unset)', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1 ], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [
    {
      [keys.primary]: 1,
      replace: { owner: null }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).pets, [],
      'related field pulled')
  }
}))


test('update many to one (push)', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      push: { pets: 1 }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).owner, 2,
      'related field set')
  }
}))


test('update many to one (push) with 2nd degree', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user,
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 2 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 1,
      push: { pets: 2 }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).owner, 1,
      'related field set')
  }
}))


test('update many to one (pull)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user,
      [ 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 2, 3 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      pull: { pets: [ 2, 3 ] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).owner, null,
      'related field set')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).owner, null,
      'related field set')
  }
}))


test('update many to one (set)', updateTest.bind({
  plan: 5,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 3,
      replace: { pets: [ 1, 2, 3 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).pets, [ 1, 2, 3 ],
      'field set')
  }
}))


test('update many to one (set) #2', updateTest.bind({
  plan: 3,
  type: 'user',
  payload: [
    {
      [keys.primary]: 3,
      replace: { pets: [ 1, 2, 3 ] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).owner, 3,
      'related field set')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).owner, 3,
      'related field set')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).owner, 3,
      'related field set')
  }
}))


test('update many to one (set) #3', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 1, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      replace: { pets: [ 1, 2 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).pets, [ 1, 2 ],
      'field set')
  }
}))


test('update many to one (unset)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 2,
      replace: { pets: [] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).owner, null,
      'related field unset')
    t.equal(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).owner, null,
      'related field unset')
  }
}))


test('update many to many (push)', updateTest.bind({
  plan: 2,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 1,
      push: { friends: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).friends.sort((a, b) => a - b),
      [ 1, 3 ], 'related ID pushed')
  }
}))


test('update many to many (pull)', updateTest.bind({
  plan: 2,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 3,
      pull: { friends: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).friends, [],
      'related ID pulled')
  }
}))


test('update many to many (set)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 1,
      replace: { friends: [ 2, 3 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).friends.sort((a, b) => a - b),
      [ 2, 3 ], 'field set')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).friends.sort((a, b) => a - b),
      [ 1, 3 ], 'related field pushed')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).friends.sort((a, b) => a - b),
      [ 1, 2 ], 'field unchanged')
  }
}))


test('update many to many (unset)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 3,
      replace: { friends: [] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).friends, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2).friends, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3).friends, [],
      'field set')
  }
}))


test('update many to many (denormalized inverse)', updateTest.bind({
  plan: 5,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      [keys.primary]: 1,
      replace: { enemies: [ 2, 3 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1).enemies.sort((a, b) => a - b),
      [ 2, 3 ], 'field set')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 1)['__user_enemies_inverse'],
      [], 'denormalized inverse field exists')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 2)['__user_enemies_inverse'],
      [ 1 ], 'related field updated')
    t.deepEqual(arrayProxy.find(response.payload,
      record => record[keys.primary] === 3)['__user_enemies_inverse']
      .sort((a, b) => a - b), [ 1, 2 ], 'related field updated')
  }
}))


function updateTest (t) {
  const { type, payload } = this
  let store
  let methods
  let change

  t.plan(this.plan)

  testInstance(t, {
    serializers: []
  })

  .then(instance => {
    store = instance
    ; ({ methods, change } = store)

    if (this.change)
      store.on(change, data =>
        this.change.call(this, t, methods, data))

    return store.dispatch({
      method: methods.update,
      type, payload
    })
  })

  .then(() => store.dispatch({
    type: this.relatedType,
    method: methods.find
  }))

  .then(this.related.bind(this, t))

  .then(() => store.disconnect())

  .then(() => t.end())

  .catch(error => {
    stderr.error.call(t, error)
    store.disconnect()
    t.fail(error)
    t.end()
  })
}
