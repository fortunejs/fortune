# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune is a high-level I/O library for web applications. It provides an implementation of [entity-relationship modelling](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model), a data storage adapter and serialization interface, and hooks for application-specific logic. These parts working together can be used to power real-time ([WebSocket](http://fortunejs.com/api/#net-websocket)) and [hypermedia](https://en.wikipedia.org/wiki/Hypermedia) applications ([RMM Level 3](http://martinfowler.com/articles/richardsonMaturityModel.html)), including web pages and HTTP APIs.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Example

Let's model an API that models Twitter's basic functionality:

```js
// store.js
const fortune = require('fortune')

module.exports = fortune.create()

.defineType('user', {
  name: { type: String },

  // Following and followers are inversely related (many-to-many).
  following: { link: 'user', inverse: 'followers', isArray: true },
  followers: { link: 'user', inverse: 'following', isArray: true },

  // Many-to-one relationship of user posts to post author.
  posts: { link: 'post', inverse: 'author', isArray: true }
})

.defineType('post', {
  message: { type: String },

  // One-to-many relationship of post author to user posts.
  author: { link: 'user', inverse: 'posts' }
})
```

Then lets add a HTTP server:

```js
// server.js
const http = require('http')
const fortune = require('fortune')
const store = require('./store')

// The `fortune.net.http` helper function returns a listener function which
// does content negotiation, and maps the internal response to a HTTP response.
const server = http.createServer(fortune.net.http(store))

store.connect().then(() => server.listen(1337))
```


This yields an *ad hoc* JSON-over-HTTP API. There are serializers for [Micro API](https://github.com/fortunejs/fortune-micro-api) (JSON-LD) and [JSON API](https://github.com/fortunejs/fortune-json-api).

By default, the data is persisted in memory. There are adapters for databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb), [Postgres](https://github.com/fortunejs/fortune-postgres), and [NeDB](https://github.com/fortunejs/fortune-nedb).

See the [plugins page](http://fortunejs.com/plugins/) for more details.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
