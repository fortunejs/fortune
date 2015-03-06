import generateApp from './generate_app';
import http from 'http';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Fortune from '../../lib';
import stderr from '../../lib/common/stderr';

const PORT = 1337;
const mediaType = 'application/vnd.api+json';
const extensions = ['patch', 'bulk'];

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise;


export default (path, request, fn) => {
  generateApp().then(app => {
    let server = http.createServer(
      Fortune.net.requestListener.bind(app)).listen(PORT);

    fetch(`http:\/\/localhost:${PORT}${path}`, Object.assign({
      headers: {
        'Accept': mediaType + (extensions.length ?
          `; ext=${extensions.join(',')}` : ''),
        'Content-Type': mediaType,
        'Connection': 'Keep-Alive'
      }
    }, request, typeof request.body === 'object' ? {
      body: JSON.stringify(request.body)
    } : null)).then(response => {
      server.close();
      stderr.debug(chalk.bold(response.status), response.headers.raw());
      return response.json();
    }).then(json => fn(json));
  });
};
