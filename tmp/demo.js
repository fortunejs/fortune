import http from 'http';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Fortune from '../lib';
import stderr from '../lib/common/stderr';

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

  fetch(`http:${'//'}localhost:${PORT}/users/5/pets`, {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify({data: [{
      __id: 'foo'
    }]})
  }).then(response => response.json(),
    error => stderr.debug(error))
  .then(json => console.log(JSON.stringify(json, null, 2)));
});
