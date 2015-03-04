import generateApp from './generate_app';
import http from 'http';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Fortune from '../../lib';
import stderr from '../../lib/common/stderr';

const PORT = 1337;
const mediaType = 'application/vnd.api+json';

// Set promise polyfill for old versions of Node.
fetch.Promise = Promise;


export default (path, request, fn) => {
  generateApp().then(app => {
    let server = http.createServer(
      Fortune.net.requestListener.bind(app)).listen(PORT);

    fetch(`http:\/\/localhost:${PORT}${path}`, Object.assign({
      headers: {
        'Accept': mediaType,
        'Content-Type': mediaType
      }
    }, request, typeof request.body === 'object' ? {
      body: JSON.stringify(request.body)
    } : null)).then(response => {
      server.close();
      return response.json();
    }).then(json => fn(json));
  });
};
