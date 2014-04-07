var fortune = require('../lib/fortune');

function createApp (options, port) {
  return fortune(options)

  .resource('person', {
    name: String,
    appearances: Number,
    pets: ['pet'],
    soulmate: {ref: 'person', inverse: 'soulmate'},
    lovers: [{ref: 'person', inverse: 'lovers'}]
  })

  .resource('pet', {
    name: String,
    appearances: Number,
    owner: 'person'
  })

  .listen(port);
  
}

module.exports = createApp;
