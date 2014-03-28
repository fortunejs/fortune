var fortune = require('../lib/fortune');

function createApp(adapter, options, port) {
  return fortune(options)

  .resource('person', {
    name: String,
    appearances: Number,
    email: String,
    pets: ['pet'],
    soulmate: {ref: 'person', inverse: 'soulmate', pkType: String},
    lovers: [{ref: 'person', inverse: 'lovers', pkType: String}]
  }, {model: {pk:"email"}})

  .resource('pet', {
    name: String,
    appearances: Number,
    owner: {ref:'person', pkType: String}
  })

  .resource('car', {
    licenseNumber: String,
    model: String,
    owner: {ref:'person', pkType: String}
  },{ model: { pk: "licenseNumber" } })

  .after('person', function() {
    this.nickname = 'Super ' + this.name;
    return this;
  })

  .after('person', function() {
    this.nickname = this.nickname + '!';
    return this;
  })

  .listen(port);
  
}

module.exports = createApp;
