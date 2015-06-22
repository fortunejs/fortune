import test from 'tape'
import ensureTypes from '../../lib/record_type/ensure_types'
import validate from '../../lib/record_type/validate'
import enforce from '../../lib/record_type/enforce'
import * as keys from '../../lib/common/keys'


const recordType = 'person'
const fields = {
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  luckyNumbers: { type: Number, isArray: true },
  friends: { link: 'person', isArray: true, inverse: 'friends' },
  spouse: { link: 'person', inverse: 'spouse' },
  toys: { type: Object, isArray: true },
  location: { type: Symbol('Geolocation data') }
}


const testFields = fields => () => validate(fields)
const testField = field => () => validate({ [field]: fields[field] })


test('validate field definition', t => {
  // Test for valid fields.
  const valid = 'valid field is valid'

  t.doesNotThrow(testField('name'), valid)
  t.doesNotThrow(testField('birthdate'), valid)
  t.doesNotThrow(testField('mugshot'), valid)
  t.doesNotThrow(testField('luckyNumbers'), valid)
  t.doesNotThrow(testField('friends'), valid)
  t.doesNotThrow(testField('toys'), valid)
  t.doesNotThrow(testField('location'), valid)

  // Test for invalid fields.
  const invalid = 'invalid field throws error'

  t.throws(testFields({
    badType: 'asdf'
  }), invalid)

  t.throws(testFields({
    nested: { thing: { type: String } }
  }), invalid)

  t.throws(testFields({
    typeAndLink: { type: String, link: 'y', inverse: 'friends' }
  }), invalid)

  t.throws(testFields({
    nonexistent: NaN
  }), invalid)

  t.throws(testFields({
    nullEdgeCase: null
  }), invalid)

  t.throws(testFields({
    fake: { type: Array }
  }), invalid)

  t.end()
})


test('enforce field definition', t => {
  const testRecord = record => () => enforce(recordType, record, fields)
  const bad = 'bad type is bad'
  const good = 'good type is good'

  t.throws(testRecord({ [keys.primary]: 1, spouse: 1 }), bad)
  t.throws(testRecord({ spouse: [ 2 ] }), bad)
  t.throws(testRecord({ friends: 2 }), bad)
  t.throws(testRecord({ [keys.primary]: 1, friends: [ 1 ] }), bad)
  t.throws(testRecord({ name: {} }), bad)
  t.doesNotThrow(testRecord({ name: '' }), good)
  t.throws(testRecord({ birthdate: {} }), bad)
  t.doesNotThrow(testRecord({ birthdate: new Date() }), good)
  t.throws(testRecord({ mugshot: {} }), bad)
  t.doesNotThrow(testRecord({ mugshot: new Buffer(1) }), good)
  t.throws(testRecord({ luckyNumbers: 1 }), bad)
  t.doesNotThrow(testRecord({ luckyNumbers: [ 1 ] }), good)
  t.doesNotThrow(testRecord({ location: new ArrayBuffer(8) }), good)
  t.throws(testRecord({
    [keys.primary]: 1,
    friends: [ 0, 1, 2 ] }
  ), 'record cannot link to itself')
  t.deepEqual(enforce(recordType,
    { friends: [ 'a', 'b', 'c', 1, 2, 3 ] }, fields).friends,
    [ 'a', 'b', 'c', 1, 2, 3 ], 'links are untouched')
  t.equal(enforce(recordType, { random: 'abc' }, fields, true).random,
    undefined, 'arbitrary fields are dropped')
  t.end()
})


test('ensure record types', t => {
  const check = recordTypes => () => ensureTypes(recordTypes)

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true }
    }
  }), 'record type must exist')

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    }
  }), 'inverse must exist')

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'foo' }
    }
  }), 'inverse is incorrect')

  t.doesNotThrow(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'comments' }
    }
  }), 'valid linking')

  t.doesNotThrow(check({
    user: {
      friends: { link: 'user', isArray: true, inverse: 'friends' }
    }
  }), 'self inverse is valid')

  const recordTypes = {
    post: {
      comments: { link: 'comment', isArray: true }
    },
    comment: {}
  }

  ensureTypes(recordTypes)

  const denormalizedField = '__post_comments_inverse'

  t.equal(recordTypes.post.comments[keys.inverse], denormalizedField,
    'denormalized inverse field assigned')

  t.equal(recordTypes.comment[denormalizedField][keys.link],
    'post', 'denormalized inverse field link correct')

  t.equal(recordTypes.comment[denormalizedField][keys.isArray],
    true, 'denormalized inverse field is array')

  t.equal(recordTypes.comment[denormalizedField][keys.denormalizedInverse],
    true, 'denormalized inverse field set')

  t.end()
})
