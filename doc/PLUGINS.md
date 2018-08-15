# Plugins

Fortune.js comes with some defaults to work out of the box. Plugins extend functionality by implementing the built-in classes, or integrating Fortune.js with an external protocol.


### Adapters

| Adapter          | Description                                              |
|:-----------------|:---------------------------------------------------------|
| Memory (included) | In-memory adapter, does not persist to disk. |
| [IndexedDB](https://github.com/fortunejs/fortune-indexeddb) | Persistent data storage adapter that works in modern browsers, falls back to memory if not available. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | NoSQL document data store. |
| [Postgres](https://github.com/fortunejs/fortune-postgres) | Relational database adapter, translates arguments directly to SQL. |
| [Redis](https://github.com/thibremy/fortune-redis) | In-memory data structure store. |
| [Google Cloud Datastore](https://github.com/patrinhani-ciandt/fortune-datastore) | Google Cloud Datastore, NoSQL. |
| [NeDB](https://github.com/fortunejs/fortune-nedb) | Embedded document data store with an API that is mostly compatible with MongoDB. |
| [File System](https://github.com/fortunejs/fortune-fs) | An extension of the built-in memory adapter that persists records on disk as flat files. |
| [localForage](https://github.com/genie-team/fortune-localforage) | Takes advantage of [localForage](https://github.com/localForage/localForage), which wraps IndexedDB, WebSQL, or localStorage. There is also a [Cordova SQLite Driver](https://github.com/thgreasi/localForage-cordovaSQLiteDriver). |


### Networking

| Implementation   | Description                                              |
|:-----------------|:---------------------------------------------------------|
| [HTTP](https://github.com/fortunejs/fortune-http) | Implements the `requestListener` function for `http.createServer`, composable with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. |
| [WebSocket](https://github.com/fortunejs/fortune-ws) | Implements the Fortune wire protocol, useful for isomorphic applications using Fortune in the browser. |


### HTTP Serializers

This section is only relevant to the `fortune-http` module.

| HTTP Serializer  | Description                                              |
|:-----------------|:---------------------------------------------------------|
| JSON (included) | A thin mapping of Fortune.js over HTTP using JSON. |
| HTML (included) | A simple user interface for Fortune.js, exposing most of its capabilities. |
| Form (included) | Create & update records using browser form input. *Input only*. |
| [Micro API](https://github.com/fortunejs/fortune-micro-api) [[spec](http://micro-api.org)] | A serialization format for hypermedia APIs. |
| [JSON API](https://github.com/fortunejs/fortune-json-api) [[spec](http://jsonapi.org)] | JSON API 1.0 compatible, useful for clients such as [Ember Data](https://github.com/emberjs/data). |
