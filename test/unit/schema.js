import Test from 'tape';
import validate from '../../lib/schema/validate';
import enforce from '../../lib/schema/enforce';
import stderr from '../../lib/common/stderr';


// Suppress validation warnings.
stderr.warn = function () {};

let schema = validate({
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  luckyNumbers: { type: Number, isArray: true },
  friends: {link: 'person', isArray: true, inverse: 'friends'},
  toys: { type: Object, isArray: true },

  // The following fields are invalid.
  typeAndLink: { type: String, link: 'y' },
  nonexistent: NaN,
  nullEdgeCase: null,
  fake: { type: Array },
  badType: 'asdf',
  nested: { thing: { type: String } }
});


export default () => {

  Test('schema validate', t => {
    t.equal(schema.name.type, String, 'string is allowed');
    t.equal(schema.birthdate.type, Date, 'date is allowed');
    t.equal(schema.birthdate.junk, 'asdf', 'extra keys not dropped');
    t.equal(schema.mugshot.type, Buffer, 'buffer is allowed');
    t.equal(schema.luckyNumbers.type, Number, 'number is allowed');
    t.equal(schema.luckyNumbers.isArray, true, 'array is allowed');
    t.equal(schema.friends.link, 'person', 'link is allowed');
    t.equal(schema.friends.inverse, 'friends', 'inverse is allowed');
    t.equal(schema.friends.isArray, true, 'array is allowed');
    t.equal(schema.toys.type, Object, 'object is allowed');
    t.equal(schema.toys.isArray, true, 'array is allowed');

    /// Test for invalid fields.
    t.equal(schema.typeAndLink, undefined, 'invalid field is empty');
    t.equal(schema.nonexistent, undefined, 'invalid field is empty');
    t.equal(schema.nullEdgeCase, undefined, 'invalid field is empty');
    t.equal(schema.fake, undefined, 'invalid field is empty');
    t.equal(schema.nested, undefined, 'invalid field is empty');
    t.equal(schema.badType, undefined, 'invalid field is empty');
    t.end();
  });

  Test('schema enforce', t => {
    let record = enforce({
      name: {},
      birthdate: 0,
      mugshot: 'SGVsbG8gd29ybGQh',
      luckyNumbers: '2',
      toys: [{foo: 'bar'}, {foo: 'baz'}, 'qq'],
      friends: ['a', 'b', 'c']
    }, schema);

    t.equal(record.constructor, Object, 'record is object');
    t.assert(record.birthdate instanceof Date, 'date is enforced');
    t.assert(Buffer.isBuffer(record.mugshot), 'buffer is enforced');
    t.deepEqual(record.luckyNumbers, [2], 'array is enforced');
    t.equal(record.toys.length, 3, 'array length is preserved');
    t.deepEqual([record.toys[0].foo, record.toys[1].foo],
      ['bar', 'baz'], 'objects are preserved');
    t.assert(record.toys[2] instanceof Object, 'object is enforced');
    t.deepEqual(record.friends, ['a', 'b', 'c'], 'links are untouched');
    t.end();
  });

};
