var fortune = require('../lib/fortune');

/**
 * Example application. It implements an imageboard with boards & posts.
 * Note that this implementation does not include access control,
 * so it's more like a wiki but without the moderation.
 */
fortune({

  adapter: "mongodb",
  db: 'relationships'

})

/*!
 * Define resources
 */
.resource("user", {
  title : String,
  firstName : String,
  lastName : String,
  role : String,
  email : String,
  nationality: String,
  languageCode: String,
  addresses: [{ref: "address", inverse: "user"}],
  flights: [{ref: "flight", inverse: "flights", pkType: String}]
}, {
  model: {pk: "email"}
})

.resource("address", {
  type: String,
  addressLine1: String,
  addressLine2: String,
  addressLine3: String,
  addressLine4: String,
  city: String,
  region: String,
  postCode: String,
  country: String,
  dateDeleted: Date,
  user: {ref: "user", inverse: "addresses", pkType: String}
})

.resource("flight", {
  flightNumber: String,
  users: [{ref: "user", inverse: "users", pkType : String}]
}, { model: { pk: "flightNumber" }})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
