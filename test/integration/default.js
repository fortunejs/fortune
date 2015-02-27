import Test from 'tape';
import http from 'http';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Fortune from '../../lib';
import stderr from '../../lib/common/stderr';
import generateApp from './app';

const PORT = 1337;
const mediaType = 'application/vnd.api+json';


export default () => {

  Test('Integration.create', t => {
    let App = generateApp();

    App.init().then(() => {
      let server = http.createServer(
        Fortune.Net.requestListener.bind(App)).listen(PORT);

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
      });
    });
  });

};
