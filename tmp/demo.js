import Fortune from '../';

const PORT = 1337;

var App = new Fortune({
  router: {
    inflect: false
  }
});

App.resource('user', {
  name: String,
  age: {type: Number, min: 0, max: 100},
  friends: {link: 'user', inverse: 'friends'}
});

App.init().then(() => {
  App.listen(PORT);
  console.log('Listening on port ' + PORT + '...');
  console.log(App);
});
