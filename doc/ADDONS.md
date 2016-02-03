# Addons

There are both internal and external addons: Adapters subclass the internal Adapter class, providing compatibility with other databases. Networking and Serializers are external, and provide a quick and easy way to expose Fortune.js over a network.


### Adapters

| Adapter          | Description                                              |
|:-----------------|:---------------------------------------------------------|
| Memory (included) | In-memory adapter, does not persist to disk. |
| IndexedDB (included) | Persistent data storage adapter that works in modern browsers. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | NoSQL document data store. |
| [Postgres](https://github.com/fortunejs/fortune-postgres) | Relational database adapter, translates arguments directly to SQL. |
| [Redis](https://github.com/thibremy/fortune-redis) | In-memory data structure store. |
| [NeDB](https://github.com/fortunejs/fortune-nedb) | Embedded document data store with an API that is mostly compatible with MongoDB. |


### Serializers

| Serializer       | Description                                              |
|:-----------------|:---------------------------------------------------------|
| JSON | A thin mapping of Fortune over HTTP using JSON. Included as part of `fortune-http`. |
| Form | Create & update records using browser form input. *Input only*. Included as part of `fortune-http`. |
| [Micro API](https://github.com/fortunejs/fortune-micro-api) [[spec](http://micro-api.org)] | A serialization format for hypermedia APIs. Requires `fortune-http`. |
| [JSON API](https://github.com/fortunejs/fortune-json-api) [[spec](http://jsonapi.org)] | JSON API 1.0 compatible, useful for clients such as [Ember Data](https://github.com/emberjs/data). Requires `fortune-http`. |


### Networking

| Implementation   | Description                                              |
|:-----------------|:---------------------------------------------------------|
| [HTTP](http://fortunejs.com/api/#net-http) | Implements the `requestListener` function for `http.createServer`, composable with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. Includes its own `Serializer` class specific to HTTP. |
| [WebSocket](http://fortunejs.com/api/#net-ws) | Implements a wire protocol for Fortune.js, useful for isomorphic applications using Fortune.js in the browser. |
