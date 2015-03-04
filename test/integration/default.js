import Test from 'tape';
import http from 'http';
import chalk from 'chalk';
import fetch from 'node-fetch';
import promisePolyfill from 'es6-promise';
import Fortune from '../../lib';
import stderr from '../../lib/common/stderr';
import generateApp from './app';

const PORT = 1337;
const mediaType = 'application/vnd.api+json';

// Set promise polyfill for old versions of Node.
if (typeof Promise === 'undefined')
  fetch.Promise = promisePolyfill.Promise;


export default () => {

  Test('Integration.create', t => {
    let App = generateApp(Fortune);

    App.init().then(() => {
      let server = http.createServer(
        Fortune.net.requestListener.bind(App)).listen(PORT);

      console.log(chalk.magenta(`Listening on port ${chalk.bold(PORT)}...`));

      fetch(`http:\/\/localhost:${PORT}/users/5/pets`, {
        method: 'POST',
        headers: {
          'Accept': `${mediaType}; ext=bulk`,
          'Content-Type': `${mediaType}`
        },
        body: JSON.stringify({data: [{
          __id: 'foo'
        }]})
      }).then(response => {
        server.close();
        stderr.debug(chalk.bold(response.status), response.headers.raw());
        return response.text();
      }).then(response => {
        try { response = JSON.parse(response); } catch (error) {}
        stderr.log(response);
        t.equal(response.data.type, 'animal', 'Type is correct.');
        t.equal(response.data.links.owner.id, '5', 'Link is correct.');
        t.end();
      }).catch(error => {
        t.fail(error);
      });
    });
  });

};
