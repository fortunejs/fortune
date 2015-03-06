var fortune = require('../lib/fortune'),
    express = require("express");

/**
* Example application.
**/

var app = express();


fortune({

  adapter: "mongodb",
  db: 'router_1',
  router: app,
  serviceName: "user-service"

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
  addresses: [{ref: "address", inverse: "user"}],
  // flights: [{ref:"flight", external: true, pkType: String}]
}, {
  model: {pk:"email"}
})

.resource("address", {
  user: {ref: "user", inverse: "addresses", pkType: String}
})


fortune({

  adapter: "mongodb",
  db: 'router_2',
  router: app,
  serviceName: "flight-service"

})

/*!
 * Define resources
 */
.resource("flight", {
  flightCode : String,
  departs : String,
  arrives : String,
  departDate: Date,
  // passengers: [{ref:"user", external: true, pkType: String}]
}, {
  model: {pk:"flightCode"}
})


/*!
 * Start the API
 */
 var srv = require("http")
      .createServer(app);

srv.listen(process.argv[2] || 1337, function() {
  console.log("Service started");
});
