# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortune.js.org)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune.js is a non-native graph [database abstraction layer](https://en.wikipedia.org/wiki/Database_abstraction_layer) that implements graph-like features on the application-level for Node.js and web browsers. It provides a common interface for databases, as well as relationships, inverse updates, referential integrity, which are built upon assumptions in the data model.

It's particularly useful for:

- Bi-directional relationships in any database.
- Applications that need storage options to be portable.
- Sharing the same data models on the server and client.

[View the website](http://fortune.js.org) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```

*This is the core module. Additional features such as networking (HTTP, WebSocket), database adapters, serialization formats are listed in the [plugins page](http://fortune.js.org/plugins).*


## Usage

Only record type definitions need to be provided. These definitions describe what data types may belong on a record and what relationships they may have, for which Fortune.js does inverse updates and maintains referential integrity. Here's an example of a basic micro-blogging service:

```js
const fortune = require('fortune') // Works in web browsers, too.

const store = fortune({
  user: {
    name: String,

    // Following and followers are inversely related (many-to-many).
    following: [ Array('user'), 'followers' ],
    followers: [ Array('user'), 'following' ],

    // Many-to-one relationship of user posts to post author.
    posts: [ Array('post'), 'author' ]
  },
  post: {
    message: String,

    // One-to-many relationship of post author to user posts.
    author: [ 'user', 'posts' ]
  }
})
```

Note that the primary key `id` is reserved, so there is no need to specify this. Links are `id`s that are maintained internally at the application-level by Fortune.js, and are always denormalized so that every link has a back-link. What this also means is that changes in a record will affect the links in related records.

By default, the data is persisted in memory (and IndexedDB for the browser). There are adapters for databases such as [MongoDB](https://github.com/fortunejs/fortune-mongodb), [Postgres](https://github.com/fortunejs/fortune-postgres), and [NeDB](https://github.com/fortunejs/fortune-nedb). See the [plugins page](http://fortune.js.org/plugins/) for more details.

Fortune has 4 main methods: `find`, `create`, `update`, & `delete`, which correspond to [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete). The method signatures are as follows:

```js
// The first argument `type` is always required. The optional `include`
// argument is used for finding related records in the same request and is
// documented in the `request` method, and the optional `meta` is specific to
// the adapter. All methods return promises.
store.find(type, ids, options, include, meta)
store.create(type, records, include, meta) // Records required.
store.update(type, updates, include, meta) // Updates required.
store.delete(type, ids, include, meta)

// For example...
store.find('user', 123).then(results => { ... })
```

The first method call to interact with the database will trigger a connection to the data store, and it returns the result as a Promise. The specific methods wrap around the more general `request` method, see the [API documentation for `request`](http://fortune.js.org/api/#fortune-request).


## Input and Output Hooks

I/O hooks isolate business logic, and are part of what makes the interface reusable across different protocols. An input and output hook function may be defined per record type. Hook functions accept at least two arguments, the `context` object, the `record`, and optionally the `update` object for an `update` request. The method of an input hook may be any method except `find`, and an output hook may be applied on all methods.

An input hook function may optionally return or resolve a value to determine what gets persisted, and it is safe to mutate any of its arguments. The returned or resolved value must be the record if it's a create request, the update if it's an update request, or anything (or simply `null`) if it's a delete request. For example, an input hook function for a record may look like this:

```js
function input (context, record, update) {
  switch (context.request.method) {
    // If it's a create request, return the record.
    case 'create': return record

    // If it's an update request, return the update.
    case 'update': return update

    // If it's a delete request, the return value doesn't matter.
    case 'delete': return null
  }
}
```

An output hook function may optionally return or resolve a record, and it is safe to mutate any of its arguments.

```js
function output (context, record) {
  record.accessedAt = new Date()
  return record
}
```

Based on whether or not the resolved record is different from what was passed in, serializers may decide not to show the resolved record of the output hook for update and delete requests.

Hooks for a record type may be defined as follows:

```js
const store = fortune({
  user: { ... }
}, {
  hooks: {
    // Hook functions must be defined in order: input first, output last.
    user: [ input, output ]
  }
})
```


## Networking

There is a [HTTP listener implementation](https://github.com/fortunejs/fortune-http), which returns a Node.js request listener that may be composed within larger applications. It maps Fortune requests and responses to the HTTP protocol automatically:

```js
// Bring your own HTTP! This makes it easier to add SSL and allows the user to
// choose between different HTTP implementations, such as HTTP/2.
const http = require('http')
const fortune = require('fortune')
const fortuneHTTP = require('fortune-http')

const store = fortune(...)

// The `fortuneHTTP` function returns a listener function which does
// content negotiation, and maps the internal response to a HTTP response.
const listener = fortuneHTTP(store)
const server = http.createServer((request, response) =>
  listener(request, response)
  .catch(error => { /* error logging */ }))

store.connect().then(() => server.listen(1337))
```

This yields an *ad hoc* JSON over HTTP API, as well as a HTML interface for humans. There are also serializers for [Micro API](https://github.com/fortunejs/fortune-micro-api) (JSON-LD) and [JSON API](https://github.com/fortunejs/fortune-json-api).

Fortune.js implements its own [wire protocol](https://github.com/fortunejs/fortune-ws) based on [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSockets_API) and [MessagePack](http://msgpack.org), which is useful for soft real-time applications.


## Features and Non-Features

- Inverse relationship updates, automatically maintain both sides of relationships between records.
- Referential integrity, ensure that links must be valid at the application level.
- Type validations, fields are guaranteed to belong to a single type.
- Adapter interface, use any database that can implement an adapter.
- **No** object-relational mapping (ORM) or active record pattern, just plain data objects.
- **No** coupling with network protocol, handle requests from anywhere.


## Requirements

Fortune.js is written in ECMAScript 5.1, with one ECMAScript 6 addition: **Promise**. Most of its public API returns Promises to be compatible with future editions of the language.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
