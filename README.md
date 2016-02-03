# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune.js is a database abstraction layer for Node.js and web browsers. It allows databases to be swapped interchangeably, including some application-level features to accomplish this. Included are IndexedDB and memory adapters, and there are also adapters for MongoDB, Postgres, and more.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Abstract

Fortune.js has a minimal public interface, mostly just the constructor and `request` method. Calling `request` dispatches calls to the `Adapter`, based on the request data. Optionally, transform functions may be defined to isolate business logic, so that it may stay consistent no matter what `Adapter` is used.


## Example

The only necessary input is record type definitions. Here's a model of a basic micro-blogging service:

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

To make a request internally using the API:

```js
store.request({
  type: 'user',
  method: 'create',
  payload: [ { name: 'John Doe' }, { name: 'Jane Doe' } ]
})
```

The first call to `request` will trigger a connection to the data store, and it returns the result as a Promise.

See the [addons page](http://fortunejs.com/addons/) for useful extensions.


## Features and Non-Features

- Type validations, with support for custom types.
- Application-level denormalized inverse relationships.
- Dereferencing relationships in a single request.
- *Isomorphic*, backed by IndexedDB in web browsers.
- **No** active record pattern, records are just plain objects.


## Requirements

Fortune.js is written in ECMAScript 5.1 syntax, with some ECMAScript 6 additions.

- **Promise** (ES6): not supported in IE, supported in Edge.
- **WeakMap** (ES6): supported in IE11+, Edge.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
