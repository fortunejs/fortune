# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

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


## Key Concepts

- **Define record types and get CRUD for free.**
- The adapter interacts with data storage.
- The serializer parses requests and renders responses, networking optional.
- The dispatcher maps to a stateless protocol (typically HTTP), with events as a side effect.


## Example

Here is a minimal example application, including a web server:

```js
import fortune from 'fortune'
import http from 'http'

const app = fortune.create()
const server = http.createServer(fortune.net.http(app))
```

This sets up an instance of Fortune with default options, and an HTTP server instance. The `fortune.net.http` module returns a listener function that does content negotiation to determine which serializers to use for I/O, and forwards Node's built-in `request` and `response` objects to the serializers.

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

Finally we need to call `start` before we do anything with the instance. Then we can let the server listen, which yields a HTTP API that conforms to the [Micro API](http://micro-api.org) and [JSON API](http://jsonapi.org) specifications. By default, it is backed by an embedded document store, [NeDB](https://github.com/louischatriot/nedb), which doesn't persist to disk by default.

For the Micro API serializer, we get these routes:

| Verb   | Route                   | Description                                                   |
|:---------|:----------------------|:--------------------------------------------------------------|
| `GET`    | `/`                   | Get the index including links to collections.                 |
| `GET`    | `/:type`              | Get a collection of records.                                  |
| `POST`   | `/:type`              | Create a record belonging to that collection.                 |
| `PATCH`  | `/:type`              | Update records belonging to that collection.                  |
| `DELETE` | `/:type`              | Delete an entire collection of records.                       |
| `GET`    | `/:type/:ids`         | Get records by comma separated IDs.                           |
| `PATCH`  | `/:type/:ids`         | Update records by comma separated IDs.                        |
| `DELETE` | `/:type/:ids`         | Delete records by comma separated IDs.                        |
| `GET`    | `/:type/:ids/:link`   | Get related records.                                          |
| `POST`   | `/:type/:ids/:link`   | Create related records.                                       |
| `PATCH`  | `/:type/:ids/:link`   | Update related records.                                       |
| `DELETE` | `/:type/:ids/:link`   | Delete related records.                                       |

The JSON API serializer emits routes specified [here](http://jsonapi.org/format/).


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
