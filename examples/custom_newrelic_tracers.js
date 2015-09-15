var nr = require( "newrelic" );
var fortune = require('../lib/fortune');
var when = require('when');

function fakeSlowFn1( callback ){
  setTimeout( function(){ callback(); }, 1000 );
}


function fakeSlowFn2( callback ){
  setTimeout( function(){ callback(); }, 2000 );
}


function fakeSlowFn3( callback ){
  setTimeout( function(){ callback(); }, 3000 );
}

var customSlowAction = {
  name: 'custom-slow-action',
  method: 'POST',
  config: {
    configHeader: 'set from init function'
  },
  init: function(options){
    return function(req, res){
      var promise1 = when.promise( fakeSlowFn1 );
      var promise2 = when.promise( fakeSlowFn2 );
      var promise3 = when.promise( fakeSlowFn3 );
      var that = this;

      return promise1
        .then( nr.createTracer('testProm1', function(){
          return promise2;
        }))
        .then( nr.createTracer('testProm2', function(){
          return promise3;
        }))
        .then( nr.createTracer('testProm3', function(){
          return that;
        }));
    }
  }
}

fortune({

  adapter: "mongodb",
  db: 'relationships_minimal'

})

/*!
 * Define resources
 */
.resource("user", {
  userType : String,
  title : String,
  firstName : String,
  lastName : String,
  email: String,
  addresses: [{ref: "address", inverse: "user"}]
}, {
  model: {pk:"email"},
  actions: {
    'custom-slow-action': customSlowAction
  }
})

.resource("address", {
  user: {ref: "user", inverse: "addresses", pkType: String}
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
