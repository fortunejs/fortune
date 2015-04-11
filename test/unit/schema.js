import Test from 'tape'
import checkSchemas from '../../lib/schema/check_schemas'
import validate from '../../lib/schema/validate'
import enforce from '../../lib/schema/enforce'
import stderr from '../../lib/common/stderr'
import primaryKey from '../../lib/common/primary_key'


// Suppress validation warnings.
stderr.warn = function () {}

const schema = validate({
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  luckyNumbers: { type: Number, isArray: true },
  friends: { link: 'person', isArray: true, inverse: 'friends' },
  toys: { type: Object, isArray: true },

  // The following fields are invalid and should be dropped.
  typeAndLink: { type: String, link: 'y', inverse: 'friends' },
  nonexistent: NaN,
  nullEdgeCase: null,
  fake: { type: Array },
  badType: 'asdf',
  noInverse: { link: 'person' },
  nested: { thing: { type: String } }
})


Test('schema validate', t => {
  t.equal(schema.name.type, String, 'string is allowed')
  t.equal(schema.birthdate.type, Date, 'date is allowed')
  t.equal(schema.birthdate.junk, 'asdf', 'extra keys not dropped')
  t.equal(schema.mugshot.type, Buffer, 'buffer is allowed')
  t.equal(schema.luckyNumbers.type, Number, 'number is allowed')
  t.equal(schema.luckyNumbers.isArray, true, 'array is allowed')
  t.equal(schema.friends.link, 'person', 'link is allowed')
  t.equal(schema.friends.inverse, 'friends', 'inverse is allowed')
  t.equal(schema.friends.isArray, true, 'array is allowed')
  t.equal(schema.toys.type, Object, 'object is allowed')
  t.equal(schema.toys.isArray, true, 'array is allowed')

  /// Test for invalid fields.
  const invalid = 'invalid field is empty'
  t.equal(schema.typeAndLink, undefined, invalid)
  t.equal(schema.nonexistent, undefined, invalid)
  t.equal(schema.nullEdgeCase, undefined, invalid)
  t.equal(schema.fake, undefined, invalid)
  t.equal(schema.noInverse, undefined, invalid)
  t.equal(schema.nested, undefined, invalid)
  t.equal(schema.badType, undefined, invalid)
  t.end()
})


Test('schema enforce', t => {
  const testRecord = record => () => enforce(record, schema)
  const bad = 'bad type is bad'
  const good = 'good type is good'

  t.throws(testRecord({ name: {} }), bad)
  t.doesNotThrow(testRecord({ name: '' }), good)
  t.throws(testRecord({ birthdate: {} }), bad)
  t.doesNotThrow(testRecord({ birthdate: new Date() }), good)
  t.throws(testRecord({ mugshot: {} }), bad)
  t.doesNotThrow(testRecord({ mugshot: new Buffer(1) }), good)
  t.throws(testRecord({ luckyNumbers: 1 }), bad)
  t.doesNotThrow(testRecord({ luckyNumbers: [1] }), good)
  t.throws(testRecord({ friends: 1 }), bad)
  t.throws(testRecord({
    [primaryKey]: 1,
    friends: [0, 1, 2] }
  ), 'record cannot link to itself')
  t.deepEqual(enforce({ friends: ['a', 'b', 'c', 1, 2, 3] }, schema).friends,
    ['a', 'b', 'c', 1, 2, 3], 'links are untouched')
  t.equal(enforce({ random: 'abc' }, schema).random,
    undefined, 'arbitrary fields are dropped')
  t.end()
})


Test('check schema', t => {
  const check = schemas => () => checkSchemas(schemas)

  t.throws(check({
    post: {
      comments: { link: 'comment', isArray: true }
    }
  }), 'type must exist')

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

  t.end()
})
