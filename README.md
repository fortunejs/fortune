[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/rewrite.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE)
[![Piggu](https://img.shields.io/badge/pigs-flying-fca889.svg?style=flat-square)](http://fortunejs.com)

Fortune is a library for working with data on the server-side, intended to provide building blocks for web applications.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```

Currently *alpha* software. Things will break, check the [changelog](https://github.com/fortunejs/fortune/blob/rewrite/doc/CHANGELOG.md).


### Key Concepts

- **Define record types and get CRUD for free.**
- Two interchangeable components: the adapter and serializers.
- The adapter interacts with data storage.
- Serializers parse requests and render responses.
- Stateless request and response, with events as a side effect.
- Networking is optional, may be handled by serializers.


### Example

Here is an example application, including a web server implementation:

```js
import Fortune from 'fortune'
import http from 'http'

const app = new Fortune()

const server = http.createServer((request, response) =>
  Fortune.net.http(app, request, response)
  .then(response.end.bind(response))
```

This sets up an instance of Fortune with default options, and an HTTP server instance. The `Fortune.net.http` module does content negotiation to determine which serializers to use for I/O, and forwards Node's built-in `request` and `response` objects to the serializers.

```js
app.defineType('user', {
  name: { type: String },
  groups: { link: 'group', inverse: 'members', isArray: true }
})

app.defineType('group', {
  name: { type: String },
  members: { link: 'user', inverse: 'group', isArray: true }
})
```

Defining record types. There is a many-to-many relationship between `user` and `group` on the `groups` and `members` fields respectively.

```js
app.start().then(() => server.listen(1337))
```

Finally we need to call `start` before we do anything with the instance. Then we can let the server listen, which yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and a custom implementation of [Micro API](http://micro-api.org) specification. By default, it is backed by an embedded datastore, NeDB (which doesn't persist to disk by default).


### License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
