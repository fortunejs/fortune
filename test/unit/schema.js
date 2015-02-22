import Test from 'tape';
import parser from '../../lib/schema/parser';
import enforcer from '../../lib/schema/enforcer';
import stderr from '../../lib/common/stderr';

// Suppress parser warnings.
stderr.warn = function () {};

let schema = parser({
  name: 'string',
  birthdate: {type: Date, junk: 'asdf'},
  mugshot: {type: 'buffer', link: null, inverse: null},
  lucky_numbers: [Number, 42],
  toys: {type: [Object]},
  friends: {link: ['person'], inverse: 'friends'},
  spouse: {type: 'z', link: 'person', inverse: 'spouse'},
  nonexistent: NaN,
  null_edge_case: null,
  fake: [],
  bad_type: 'asdf',
  nested: {thing: String}
});

let options = {
  bufferEncoding: 'base64',
  dropArbitraryFields: true
};

export default () => {

  Test('Schema.Parser', t => {
    t.equal(schema.name.type, 'string', 'Parses native type.');
    t.equal(schema.birthdate.type, 'date', 'Parses object with native type.');
    t.equal(schema.birthdate.junk, 'asdf', 'Extra keys are not dropped.');
    t.equal(schema.mugshot.type, 'buffer', 'Parses object with string type.');
    t.equal(schema.lucky_numbers.type, 'number', 'Parses array of native type.');
    t.equal(schema.lucky_numbers.isArray, true, 'Parses array as array.');
    t.equal(schema.toys.type, 'object', 'Parses object with array of native type.');
    t.equal(schema.toys.isArray, true, 'Parses array as array.');
    t.equal(schema.friends.link, 'person', 'Parses link.');
    t.equal(schema.friends.inverse, 'friends', 'Parses inverse of link.');
    t.equal(schema.friends.isArray, true, 'Parses array of links.');
    t.equal(schema.spouse.link, 'person', 'Parses link.');
    t.equal(schema.spouse.inverse, 'spouse', 'Parses inverse of link.');
    t.equal(schema.spouse.isArray, false, 'Parses single link.');
    t.equal(schema.nonexistent, undefined, 'Drops NaN.');
    t.equal(schema.null_edge_case, undefined, 'Drops null.');
    t.equal(schema.fake, undefined, 'Drops empty array.');
    t.equal(schema.nested, undefined, 'Drops object without link or type.');
    t.equal(schema.bad_type, undefined, 'Drops invalid type.');
    t.end();
  });

  Test('Schema.Enforcer input', t => {
    let enforced = enforcer({
      name: {},
      birthdate: 0,
      mugshot: 'SGVsbG8gd29ybGQh',
      lucky_numbers: '2',
      toys: [{foo: 'bar'}, {foo: 'baz'}, 'qq'],
      friends: ['a', 'b', 'c']
    }, schema, Object.assign(options, { output: false }));

    t.equal(enforced.name, '[object Object]', 'Casts into string.');
    t.assert(enforced.birthdate instanceof Date, 'Casts into date.');
    t.assert(Buffer.isBuffer(enforced.mugshot), 'Casts into buffer.');
    t.deepEqual(enforced.lucky_numbers, [2], 'Casts into number.');
    t.equal(enforced.toys.length, 3, 'Casts into array.');
    t.deepEqual([enforced.toys[0].foo, enforced.toys[1].foo],
      ['bar', 'baz'], 'Objects are objects.');
    t.assert(typeof enforced.toys[2] === 'object', 'Casts into object.');
    t.deepEqual(enforced.friends, ['a', 'b', 'c']);
    t.end();
  });

  Test('Schema.Enforcer output', t => {
    let enforced = enforcer({
      birthdate: new Date(0),
      lucky_numbers: ['1', 2, '3'],
      mugshot: new Buffer('SGVsbG8gd29ybGQh', 'base64'),
      toys: 2
    }, schema, Object.assign(options, { output: true }));

    t.equal(enforced.birthdate, 0, 'Date casted to number.');
    t.deepEqual(enforced.lucky_numbers, [1, 2, 3], 'Types are mangled.');
    t.equal(enforced.mugshot, 'SGVsbG8gd29ybGQh', 'Buffer casted to base64.');
    t.assert(enforced.toys.length === 1 &&
      typeof enforced.toys[0] === 'object', 'Mangled to array of objects.');
    t.end();
  });

};
