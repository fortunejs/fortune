# Plugins

Fortune.js comes with some defaults to work out of the box. Plugins extend functionality by implementing the built-in classes, or integrating Fortune.js with an external protocol.


### Adapters

| Adapter          | Description                                              |
|:-----------------|:---------------------------------------------------------|
| Memory (included, default) | In-memory adapter, does not persist to disk. |
| IndexedDB (included, default) | Persistent data storage adapter that works in modern browsers. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | NoSQL document data store. |
| [Postgres](https://github.com/fortunejs/fortune-postgres) | Relational database adapter, translates arguments directly to SQL. |
| [Redis](https://github.com/thibremy/fortune-redis) | In-memory data structure store. |
| [NeDB](https://github.com/fortunejs/fortune-nedb) | Embedded document data store with an API that is mostly compatible with MongoDB. |


### HTTP Serializers

| HTTP Serializer  | Description                                              |
|:-----------------|:---------------------------------------------------------|
| JSON (included, default) | A thin mapping of Fortune over HTTP using JSON. |
| Form (included, default) | Create & update records using browser form input. *Input only*. |
| [Micro API](https://github.com/fortunejs/fortune-micro-api) [[spec](http://micro-api.org)] | A serialization format for hypermedia APIs. |
| [JSON API](https://github.com/fortunejs/fortune-json-api) [[spec](http://jsonapi.org)] | JSON API 1.0 compatible, useful for clients such as [Ember Data](https://github.com/emberjs/data). |


### Networking

| Implementation   | Description                                              |
|:-----------------|:---------------------------------------------------------|
| [HTTP](http://fortunejs.com/api/#net-http) (included) | Implements the `requestListener` function for `http.createServer`, composable with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. |
| [WebSocket](http://fortunejs.com/api/#net-ws) (included) | Implements the Fortune wire protocol, useful for isomorphic applications using Fortune in the browser. |
