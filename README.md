# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune.js is an [application system](http://systems-analysis.net/application/definition.html) for Node.js and web browsers. It segregates data access, business logic, and external I/O, providing a baseline for interoperability and allowing each implementation to be swapped interchangeably.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Abstract

Fortune.js provides three extensible interfaces that work together: `Adapter`, `Serializer`, and transform functions.

- The `Adapter` abstraction allows for multiple persistence back-ends, such as common server-side databases like Postgres and MongoDB, and IndexedDB in the web browser.
- The `Serializer` abstraction allows for multiple I/O formats, including media types such as [Micro API](http://micro-api.org) and [JSON API](http://jsonapi.org), standard input formats such as URL encoded and form data, and custom serializers for HTML.
- Transform functions isolate business logic, so that it may stay consistent no matter what adapter, serializer, or network protocol is used.

Included are networking wrappers which call the `request` method, so it is not coupled with any external protocol, and it should be able to work with any transport layer.


## Example

The only necessary input is record type definitions. Here's a model of a subset of Twitter's functionality:

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

By default, the data is persisted in memory. There are adapters for databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb), [Postgres](https://github.com/fortunejs/fortune-postgres), and [NeDB](https://github.com/fortunejs/fortune-nedb). Then let's add a HTTP server:

```js
const http = require('http')

// The `fortune.net.http` helper function returns a listener function which
// does content negotiation, and maps the internal response to a HTTP response.
const server = http.createServer(fortune.net.http(store))

store.connect().then(() => server.listen(1337))
```

This yields an *ad hoc* JSON over HTTP API. There are serializers for [Micro API](https://github.com/fortunejs/fortune-micro-api) (JSON-LD) and [JSON API](https://github.com/fortunejs/fortune-json-api), as well as a [wire protocol](http://fortunejs.com/api/#net-ws) based on [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSockets_API) and [MessagePack](http://msgpack.org).

See the [plugins page](http://fortunejs.com/plugins/) for more details.


## Features and Non-Features

- Type validations, with support for custom types.
- Application-level denormalized inverse relationships.
- Dereferencing relationships in a single request.
- *Isomorphic*, backed by IndexedDB in web browsers, including a built-in wire protocol for data synchronization.
- **No** active record pattern, just plain data objects.
- **No** coupling with network protocol.


## Requirements

Fortune.js is written in ECMAScript 5.1 syntax, with some ECMAScript 6 additions.

- **Promise** (ES6): not supported in IE, supported in Edge.
- **WeakMap** (ES6): supported in IE11+, Edge.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
