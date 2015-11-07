# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune is an [application system](http://systems-analysis.net/architecture/introduction.html) for Node.js & web browsers. It provides a data access layer (adapter), business logic layer (transform), and presentation layer (serializer). These layers working together allow for multiple data sources to be exposed via multiple formats through a uniform interface.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```

There is roughly 3.2k lines of code, and its size is about 22kb (min+gzip).


## Example

Let's build an API that models Twitter's basic functionality:

```js
// store.js
const fortune = require('fortune')

module.exports = fortune()

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

By default, the data is persisted in memory. There are adapters for databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb), [Postgres](https://github.com/fortunejs/fortune-postgres), and [NeDB](https://github.com/fortunejs/fortune-nedb). Then let's add a HTTP server:

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

See the [plugins page](http://fortunejs.com/plugins/) for more details.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
