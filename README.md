# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortune.js.org)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![Dependency Status](https://david-dm.org/fortunejs/fortune.svg?style=flat-square)](https://david-dm.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune.js is a library for managing structured data in Node.js and web browsers. It consists of a data abstraction layer and networking functions.

[View the website](http://fortune.js.org) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Synopsis

Fortune.js implements a data abstraction layer, and also includes networking functions, specific for Node.js and web browsers. There are a variety of use cases for Fortune.js, for example:

- A server-side implementation of a web service over HTTP. The included HTTP implementation provides a basis for implementing application-level protocols, including media types such as HTML (included), [Micro API](http://micro-api.org) and [JSON API](http://jsonapi.org), and covers standard input formats such as URL encoded and form data.
- A persistence layer in web browsers. Under the hood, it uses IndexedDB, Web Worker, and MessagePack to achieve high performance for persisting structured data.
- An abstraction layer for working with multiple databases. Write the same logic which will work across multiple adapters.
- Real-time web applications. Fortune.js includes its own [wire protocol](http://fortune.js.org/api/#fortune.net-ws) based on WebSocket and MessagePack.


## Example

The only required input is record type definitions. Here's a model of a basic micro-blogging service:

```js
const fortune = require('fortune')

const store = fortune({
  user: {
    name: { type: String },

    // Following and followers are inversely related (many-to-many).
    following: { link: 'user', inverse: 'followers', isArray: true },
    followers: { link: 'user', inverse: 'following', isArray: true },

    // Many-to-one relationship of user posts to post author.
    posts: { link: 'post', inverse: 'author', isArray: true }
  },
  post: {
    message: { type: String },

    // One-to-many relationship of post author to user posts.
    author: { link: 'user', inverse: 'posts' }
  }
})
```

By default, the data is persisted in memory. There are adapters for databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb), [Postgres](https://github.com/fortunejs/fortune-postgres), and [NeDB](https://github.com/fortunejs/fortune-nedb). To make a request internally:

```js
store.request({
  type: 'user',
  method: 'create',
  payload: [ { name: 'John Doe' }, { name: 'Jane Doe' } ]
})
```

The first call to `request` will trigger a connection to the data store, and it returns the result as a Promise.

Then let's add a HTTP server:

```js
const http = require('http')

// The `fortune.net.http` helper function returns a listener function which
// does content negotiation, and maps the internal response to a HTTP response.
const server = http.createServer(fortune.net.http(store))

store.connect().then(() => server.listen(1337))
```

This yields an *ad hoc* JSON over HTTP API, as well as a HTML interface for humans. There are serializers for [Micro API](https://github.com/fortunejs/fortune-micro-api) (JSON-LD) and [JSON API](https://github.com/fortunejs/fortune-json-api), which also accept HTTP parameters. In addition, Fortune.js implements a [wire protocol](http://fortune.js.org/api/#fortune.net-ws) based on [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSockets_API) and [MessagePack](http://msgpack.org).

See the [plugins page](http://fortune.js.org/plugins/) for more details.


## Features and Non-Features

- Type validations, with support for custom types.
- Application-level denormalized inverse relationships.
- Dereferencing relationships in a single request.
- *Isomorphic*, backed by IndexedDB in web browsers, including a built-in wire protocol for data synchronization.
- **No** active record pattern, just plain data objects.
- **No** coupling with network protocol, they are treated as external I/O.


## Requirements

Fortune.js is written in ECMAScript 5.1 syntax, with some ECMAScript 6 additions.

- **Promise** (ES6): not supported in IE, supported in Edge. Bring your own implementation (optional).
- **WeakMap** (ES6): supported in IE11+, Edge. Polyfills exist, but they have their shortcomings since it must be implemented natively.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
