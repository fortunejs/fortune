var harvest = require('../lib/harvest')
  , express = harvest.express;

/**
 * Example demonstrating two different databases being
 * exposed through one API. Note that each instance is
 * not automatically aware of any other instances, so
 * you will have to solve any problems that arise from
 * that yourself.
 */
var container = express()
  , port = process.argv[2] || 1337;

var peopleAPI = harvest({
  db: 'people'
})
.resource('person', {
  name: String,
  age: Number
});

var animalsAPI = harvest({
  db: 'animals'
})
.resource('animal', {
  name: String,
  type: String,
  age: Number
});

container
  .use(peopleAPI.router)
  .use(animalsAPI.router)
  .get('/', function(req, res) {
    res.send('Hello, you have reached the zoo API.');
  })
  .listen(port);

console.log('Listening on port ' + port + '...');
