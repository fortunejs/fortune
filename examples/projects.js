var fortune = require('../lib/fortune');

/**
 * Example application. It implements an imageboard with boards & posts.
 * Note that this implementation does not include access control,
 * so it's more like a wiki but without the moderation.
 */
fortune({

  adapter: "mongodb",
  db: 'projects'

})

/*!
 * Define resources
 */
.resource("project", {
  name : String,
  tasks: [{ref: "task", inverse: "project"}]
})

.resource("task", {
  name: String,
  comments: [{ref: "comment", inverse: "task"}],
  project: {ref: "project", inverse: "tasks", pkType: String},
  status: {ref: "status", inverse: "tasks", pkType: String}
})

.resource("status", {
  name: String,
  tasks: [{ref: "task", inverse: "status"}]
})

.resource("comment", {
  name: String,
  task: {ref: "task", inverse: "comments", pkType: String}
})

/*!
 * Start the API
 */
.listen(process.argv[2] || 1337);
