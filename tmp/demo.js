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
  friends: {link: 'user', inverse: 'friends'},
  pets: {link: ['animal'], inverse: 'owner'}
});

App.resource('animal', {
  name: String,
  owner: {link: 'user', inverse: 'pets'}
});

App.init().then(() => {
  App.listen(PORT);
  console.log('Listening on port ' + PORT + '...');

  App.router.request({
    type: 'user',
    ids: ['1234'],
    relatedField: 'pets',
    serializerOutput: 'application/vnd.api+json'
  });
});
