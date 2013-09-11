var fortune = require('../lib/fortune');

function createApp(adapter, options, port) {

  return fortune(options)

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
  
}

module.exports = createApp;
