# Plugins

Fortune comes with some defaults to work out of the box, and there are alternatives to the defaults. The Adapter and Serializer classes adhere to the [polymorphic open/closed principle](https://en.wikipedia.org/wiki/Open/closed_principle#Polymorphic_open.2Fclosed_principle), so they should be extended (subclassed) rather than modified.


### Adapters

Adapters must subclass and implement the Adapter class. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included, default) | [Dali Zheng](http://daliwa.li) | Embedded document data store with an API that is mostly compatible with MongoDB. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | [Dali Zheng](http://daliwa.li) | Document data store. MongoDB is [web scale](http://www.mongodb-is-web-scale.com/). |
| [PostgreSQL](https://github.com/fortunejs/fortune-pg) | [Dali Zheng](http://daliwa.li) | Relational database adapter, translates adapter method inputs to SQL. |


### Serializers

Serializers process data, they must subclass and implement the Serializer class.

| Serializer       | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [Micro API](http://micro-api.org) (included, default) | [Dali Zheng](http://daliwa.li) | A minimal serialization format for hypermedia APIs. |
| [JSON API](http://jsonapi.org) (included, default) | [Dali Zheng](http://daliwa.li) | Tracking JSON API 1.0, useful for clients such as [Ember Data](https://github.com/emberjs/data). |


### Networking

Network helpers may map external input to the dispatcher and map the response to an external output. Using Fortune with a network protocol is optional.

| Implementation   | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [HTTP](http://fortunejs.com/api/#net-http) (included) | [Dali Zheng](http://daliwa.li) | Implements the `requestListener` function for `http.createServer`, compatible with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. |


### Browser

Fortune includes a browser build, which is acccessible at `fortune/core`. It does not come with any defaults. This build has minimal dependencies, requiring only `babel-runtime`. A CommonJS compatible build pipeline is required to use it.

```js
import Fortune from 'fortune/core'
```
