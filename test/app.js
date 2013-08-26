var fortune = require('../lib/fortune');

function createApp(adapter, port) {
  var app = fortune({
    adapter: adapter,
    db: 'fortune_test'
  })

  .resource('person', {
    name: String,
    pets: ['pet'],
    friends: ['person']
  })

  .resource('pet', {
    name: String,
    owner: 'person'
  })

  .listen(port);

  return app;
}

module.exports = createApp;
