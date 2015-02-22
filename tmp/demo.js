import http from 'http';
import chalk from 'chalk';
import request from 'request';
import Fortune from '../lib';

const PORT = 1337;

var App = new Fortune({
  primaryKeyPerType: {
    user: '_id',
    animal: '__id'
  }
});

App.resource('user', {
  name: String,
  age: {type: Number, min: 0, max: 100},
  friends: {link: 'user', inverse: 'friends'},
  pets: {link: ['animal'], inverse: 'owner'}
}).after((context, entity) => {
  entity.timestamp = Date.now();
  return Promise.resolve(entity);
});

App.resource('animal', {
  name: String,
  owner: {link: 'user', inverse: 'pets'}
}).after((context, entity) => {
  entity.a = 123;
  return entity;
});

App.init().then(() => {
  http.createServer(Fortune.Net.requestListener.bind(App)).listen(PORT);
  console.log(chalk.magenta(`Listening on port ${chalk.bold(PORT)}...`));

  App.request({
    action: 'create',
    type: 'animal',
    payload: [{
      _id: 'foo'
    }],
    ids: [2],
    relatedField: 'owner',
    include: [['owner'], ['pets']],
    serializerInput: 'application/vnd.api+json',
    serializerOutput: 'application/vnd.api+json'
  }).then((result) => {
    //console.log(JSON.stringify(result, null, 2));
    console.log(result);
  }, (error) => {
    console.log(error);
  });

  /*request({
    uri: `http:${'//'}localhost:${PORT}/users/1,2,3`,
    method: 'get',
    headers: {
      Accepts: 'application/*'
    }
  }, (error, response, body) => {
    console.log(body);
  });*/
});
