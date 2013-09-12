var fortune = require('../lib/fortune');

function createApp(adapter, options, port) {

  return fortune(options)

  .resource('person', {
    name: String,
    appearances: Number,
    pets: ['pet'],
    friends: ['person']
  })

  .resource('pet', {
    name: String,
    appearances: Number,
    owner: 'person'
  })

  .listen(port);
  
}

module.exports = createApp;
