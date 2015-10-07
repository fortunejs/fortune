var fortune = require('../lib/fortune');
var when = require('when');


fortune({
  adapter: "mongodb",
  db: 'people',
})


.resource("person", {
  name: String,
  age: Number,
  hobbies: [{
    name: String,
    hours: Number
  }],
  someObject: {
    someNestedParameter: String,
    someOtherNestedParameter: Number
  }
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
