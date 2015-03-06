var fortune = require('../lib/fortune');

/**
* Example application.
**/

// We currently only support actions on a specific resource, not all
// var adminUsers = {
//   name: 'admin-users',
//   method: 'GET',
//   type: 'scoping',
//   filter: { userType : "admin" },
//   config: {
//     configHeader: 'set from init function'
//   },
//   init: function(options){
//     console.log("admin-users init");
//     return function(req, res){
//       console.log("Sending password reset email");

//       return res;
//     }
//   }
// };

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
    // 'admin-users': adminUsers,
    'send-password-reset-email': passwordResetEmail
  }
})

.resource("address", {
  user: {ref: "user", inverse: "addresses", pkType: String}
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
