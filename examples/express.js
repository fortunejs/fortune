var fortune = require('../lib/fortune')
  , express = require('express')
  , port = process.argv[2] || 1337
  , main = express()
  , api = fortune({
    db: 'petstore'
  })
  .resource('person', {
    name: String,
    age: Number,
    pets: ['pet'] // "has many" relationship to pets
  })
  .resource('pet', {
    name: String,
    age: Number,
    owner: 'person' // "belongs to" relationship to a person
  });

main.use(express.logger('dev'));

main.get('/', function(req, res){
  res.send('Hello from main app!')
});

// Requests prefixed with "/api" will use the Fortune api app
main.use('/api', api.express);

main.listen(port);
console.log('Main app available on port ' + port);
