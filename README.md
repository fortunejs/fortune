# [![Fortune.js](https://fortunejs.github.io/fortune/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE)

Fortune is an I/O library for web applications.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune@latest --save
```

Currently *beta* software. Things will break, check the [changelog](http://fortunejs.com/changelog/).


## Key Features

- Define record types and get CRUD + hypermedia for free.
- Provide abstract base classes for data storage and serialization.
- Map to a stateless protocol (typically HTTP), with events as side effects.
- Run in a browser as a client-side store.


## Example

Here is a minimal example application, including a web server:

```js
import fortune from 'fortune'
import http from 'http'

const store = fortune.create()
const server = http.createServer(fortune.net.http(store))
```

This sets up an instance of Fortune with default options, and an HTTP server instance. The `fortune.net.http` module returns a listener function that does content negotiation to determine which serializers to use for I/O, and forwards Node's built-in `request` and `response` objects to the serializers.

```js
store.defineType('user', {
  name: { type: String },
  groups: { link: 'group', inverse: 'members', isArray: true }
})

store.defineType('group', {
  name: { type: String },
  members: { link: 'user', inverse: 'group', isArray: true }
})
```

Defining record types. There is a many-to-many relationship between `user` and `group` on the `groups` and `members` fields respectively.

```js
store.connect().then(() => server.listen(1337))
```

Finally we need to call `connect` before we do anything with the instance. Then we can let the server listen, which yields a HTTP API that conforms to the [Micro API](http://micro-api.org) and [JSON API](http://jsonapi.org) specifications. By default, it is backed by an embedded document store, [NeDB](https://github.com/louischatriot/nedb), which doesn't persist to disk by default.

For the Micro API serializer, we get a set of internal pre-defined routes. Note that by default, the routes are obfuscated to the client, to encourage the use of hypermedia.

| Method   | Route (unobfuscated)  | Description                                                   |
|:---------|:----------------------|:--------------------------------------------------------------|
| `GET`    | `/`                   | Get the entry point including links to collections.           |
| `GET`    | `/:type`              | Get a collection of records belonging to that type.           |
| `POST`   | `/:type`              | Create a record belonging to that type.                       |
| `PATCH`  | `/:type`              | Update records belonging to that type.                        |
| `DELETE` | `/:type`              | Delete an entire collection of records by type.               |
| `GET`    | `/:type/:ids`         | Get records of a type by comma separated IDs.                 |
| `PATCH`  | `/:type/:ids`         | Update records of a type by comma separated IDs.              |
| `DELETE` | `/:type/:ids`         | Delete records of a type by comma separated IDs.              |
| `GET`    | `/:type/:ids/:link`   | Get related records corresponding to a type and IDs.          |
| `PATCH`  | `/:type/:ids/:link`   | Update related records corresponding to a type and IDs.       |
| `DELETE` | `/:type/:ids/:link`   | Delete related records corresponding to a type and IDs.       |

The JSON API serializer emits routes specified [here](http://jsonapi.org/recommendations/).


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/master/LICENSE).
