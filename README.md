# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune is a high-level I/O library for web applications.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune@latest --save
```

Currently in *release candidate* stage. Things may break, check the [changelog](http://fortunejs.com/changelog/).


## Example

Let's build an API that models Twitter's basic functionality:

```js
import fortune from 'fortune'
import http from 'http'

const store = fortune.create()

// The `net.http` function returns a listener function which does content
// negotiation, parses headers, and maps the response to an HTTP response.
const server = http.createServer(fortune.net.http(store))

store.defineType('user', {
  name: { type: String },

  // Following and followers are inversely related (many-to-many).
  following: { link: 'user', inverse: 'followers', isArray: true },
  followers: { link: 'user', inverse: 'following', isArray: true },

  // Many-to-one relationship of user posts to post author.
  posts: { link: 'post', inverse: 'author', isArray: true }
})

store.defineType('post', {
  message: { type: String },

  // One-to-many relationship of post author to user posts.
  author: { link: 'user', inverse: 'posts' }
})

store.connect().then(() => server.listen(1337))
```

This yields a hypermedia API that conforms to the [Micro API](http://micro-api.org) and [JSON API](http://jsonapi.org) specifications. The default serializers emit an index route with hyperlinks and respond to `OPTIONS` requests appropriately, so that clients which understand the media types can consume the API without technical documentation. The JSON API serializer emits routes specified [here](http://jsonapi.org/recommendations/).

By default, it is backed by an embedded document store, [NeDB](https://github.com/louischatriot/nedb), which runs in memory by default, but has options to persist to disk. There are adapters for other databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb) and [Postgres](https://github.com/fortunejs/fortune-postgres), enumerated in the [plugins page](http://fortunejs.com/plugins/).


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
