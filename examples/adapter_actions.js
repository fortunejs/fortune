var fortune = require('../lib/fortune');

/**
* Example application.
**/


var aggregateByDay = {
  name: 'aggregate-by-day',
  adapter_binding: 'aggregate',
  method: 'POST',
  config: [ 
{ $match : { 'joinDate' : '2014-01-01' }}
],
  init: function(options){
    return function(req, res){
      res.send(200, 'ok');
    };
  }
};

fortune({
  adapter: 'mongodb',
  connectionString: 'mongodb://localhost/fortune_test'
})

/*!
 * Define resources
 */
.resource('user', {
  userType : String,
  title : String,
  firstName : String,
  lastName : String,
  joinDate: String
}, {
  model: {pk:'lastName'},
  actions: {
    'aggregate-by-day': aggregateByDay
  }
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
