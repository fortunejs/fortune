var harvester = require('../lib/harvester');

harvester({

  db: '1337chan'

})

/*!
 * Define resources
 */
.resource('foo', {

  name: String

})

.resource('bar', {

  name: String,
  foo: 'foo'

})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
