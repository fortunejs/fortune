var fortune = require('./index');

var app = fortune();

app.resource('person', {
  name: [String],
  age: {type: Number, validate: function(){}},
  alive: {link: ['life']},
  mugshot: Buffer,
  metadata: Object,
  birthdate: Date,
  friends: Array,

});

console.log(app.schemas);
