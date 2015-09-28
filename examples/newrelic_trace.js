var nr = require('newrelic');
var fortune = require('../lib/fortune');
var when = require('when');

var passwordResetEmail = {
  name: 'send-password-reset-email',
  method: 'POST',
  config: {
    configHeader: 'set from init function'
  },
  init: function(options){
    return function(req, res){
      console.log("Sending password reset email");
      res.send(200, 'ok');
    }
  }
};

var instrumentorObj ={
  instrumentor: nr,
  options: {}
};

fortune({
  adapter: "mongodb",
  db: 'relationships_minimal',
  customInstrumentorObj: instrumentorObj
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
    // 'admin-users': adminUsers,
    'send-password-reset-email': passwordResetEmail
  }
})

.resource("address", {
  firstLine: String,
  user: {ref: "user", inverse: "addresses", pkType: String},
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
