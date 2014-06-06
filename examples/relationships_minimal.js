var fortune = require('../lib/fortune');

/**
 * Example application. It implements an imageboard with boards & posts.
 * Note that this implementation does not include access control,
 * so it's more like a wiki but without the moderation.
 */
fortune({

  adapter: "mongodb",
  db: 'relationships_minimal'

})

/*!
 * Define resources
 */
.resource("user", {
  email: String,
  addresses: [{ref: "address", inverse: "user"}]
}, {
  model: {pk:"email"}
})

.resource("address", {
  user: {ref: "user", inverse: "addresses", pkType: String}
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
