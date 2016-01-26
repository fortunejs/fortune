# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune.js is application middleware for Node.js and web browsers. It exposes a data source via multiple formats through a uniform interface.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Abstract

>Most web apps at heart are user experience and business logic around a persistent store.

Fortune.js provides an interface to a data source. A request to Fortune.js dynamically dispatches `Adapter`, `Serializer`, and `transform` methods based on data passed to the `request` method. Networking wrappers call the `request` method, so it is not coupled with any external protocol.

The `Adapter` abstraction allows for multiple persistence back-ends, such as common server-side databases like MongoDB and Postgres, and IndexedDB in the web browser.

The `Serializer` abstraction allows for multiple serialization formats, including media types such as [JSON API](http://jsonapi.org) and [Micro API](http://micro-api.org), standard input formats such as URL encoded and form data, and custom serializers for HTML.


## Example

The only necessary input is record type definitions. Record types in Fortune.js are the basic means of modelling data. Let's model a subset of Twitter's functionality:

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

This yields an *ad hoc* JSON over HTTP API. There are serializers for [Micro API](https://github.com/fortunejs/fortune-micro-api) (JSON-LD) and [JSON API](https://github.com/fortunejs/fortune-json-api), as well as a [wire protocol](http://fortunejs.com/api/#net-ws) based on WebSocket and [MessagePack](http://msgpack.org).

See the [plugins page](http://fortunejs.com/plugins/) for more details.


## Features and Non-Features

- Entity-relationship modelling, via record type definitions.
- Type validations, with support for custom types.
- Application-level denormalized inverse relationships, handled internally when calling `request`.
- Dereferencing relationships per request via `include`.
- Core-supported extensibility including transactions, update operators, transforms, custom querying.
- *Isomorphic*, backed by IndexedDB in web browsers, including a built-in wire protocol for data synchronization.
- **No** architectural decisions such as MVC, et al.
- **No** coupling with network protocol. Although a `http` listener is included for Node.js, it's optional to use.
- **No** routing in core, this may be handled by the `Serializer` implementation, or externally, or not at all.

In general, non-core functionality is delegated externally instead of trying to do everything.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
