import Fortune from '../';

const PORT = 1337;

var App = new Fortune({
  router: {
    prefix: '/shitlord'
  }
});

App.resource('user', {
  name: String,
  age: {type: Number, min: 0, max: 100},
  friends: {link: 'user', inverse: 'friends'},
  pets: {link: ['animal'], inverse: 'owner'}
}).after(function () {
  this.timestamp = Date.now();
  return new Promise(resolve => {
    setTimeout(() => resolve(this), 1000);
  });
});

App.resource('animal', {
  name: String,
  owner: {link: 'user', inverse: 'pets'}
}).after(function () {
  this.a = 123;
  return this;
});

App.init().then(() => {
  App.listen(PORT);
  console.log('Listening on port ' + PORT + '...');

  App.router.request({
    action: 'create',
    type: 'user',
    ids: [],
    include: [['pets']],
    serializerInput: 'application/vnd.api+json',
    serializerOutput: 'application/vnd.api+json'
  }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }, (error) => {
    console.log('FAIL');
    console.log(error);
  });
});
