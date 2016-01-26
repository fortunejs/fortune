# Plugins

Fortune comes with some defaults to work out of the box, and there are alternatives to the defaults. The Adapter and Serializer classes adhere to the [polymorphic open/closed principle](https://en.wikipedia.org/wiki/Open/closed_principle#Polymorphic_open.2Fclosed_principle), so they should be extended (subclassed) rather than modified. It should be entirely possible to use Fortune without modifying its source code by extending adapters, serializers, and adding external network code.


### Adapters

Adapters must subclass and implement the Adapter class. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Description                                              |
|:-----------------|:---------------------------------------------------------|
| Memory (included, default) | In-memory adapter, does not persist to disk. |
| IndexedDB (included) | Persistent data storage adapter that works in modern browsers. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | NoSQL document data store. |
| [Postgres](https://github.com/fortunejs/fortune-postgres) | Relational database adapter, translates arguments directly to SQL. |
| [Redis](https://github.com/thibremy/fortune-redis) | In-memory data structure store. |
| [NeDB](https://github.com/fortunejs/fortune-nedb) | Embedded document data store with an API that is mostly compatible with MongoDB. |


### Serializers

Serializers process data, they must subclass and implement the Serializer class.

| Serializer       | Description                                              |
|:-----------------|:---------------------------------------------------------|
| Default (included, default) | Standard serializer for programmatic use. |
| JSON (included, default) | A thin mapping of Fortune over HTTP using JSON. |
| Form (included, default) | Create & update records using browser form input. *Input only*. |
| [Micro API](https://github.com/fortunejs/fortune-micro-api) [[spec](http://micro-api.org)] | A serialization format for hypermedia APIs. |
| [JSON API](https://github.com/fortunejs/fortune-json-api) [[spec](http://jsonapi.org)] | JSON API 1.0 compatible, useful for clients such as [Ember Data](https://github.com/emberjs/data). |


### Networking

Network helpers may map external input to a request and map the response to an external output. Using Fortune with a network protocol is optional.

| Implementation   | Description                                              |
|:-----------------|:---------------------------------------------------------|
| [HTTP](http://fortunejs.com/api/#net-http) (included) | Implements the `requestListener` function for `http.createServer`, compatible with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. |
| [WebSocket](http://fortunejs.com/api/#net-ws) (included) | Implements the Fortune wire protocol, useful for isomorphic applications using Fortune in the browser. |


### Browser

Fortune includes a browser build, which comes with the IndexedDB and memory adapter and the default serializer. A CommonJS-compatible build pipeline is required to use it, along with a bundler that supports the `browser` feature of `package.json`.

```js
var fortune = require('fortune') // Works in a web browser.
```
