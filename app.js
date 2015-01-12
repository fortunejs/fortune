var fortune = require('./fortune/lib/fortune');
var app = fortune();

app
  .resource('person', {
    name: String,
  },{
    actions: {
      'reset-password': {
        callback: resetPassword
      }
    }
  })
;

app.listen(1337);


// ACTION FUNCTIONS

function resetPassword() {
  console.log("yay! unicorns!");
}