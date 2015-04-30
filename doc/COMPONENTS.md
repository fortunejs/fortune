# Components

Fortune comes with some defaults to work out of the box, and there are alternatives to the defaults.


## Adapters

Adapters must subclass and implement the Adapter class. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included, default) | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |
| [MongoDB](https://mongodb.com) (included) | [Dali Zheng](http://daliwa.li) | Document data store. |


## Serializers

Serializers process data, they must subclass and implement the Serializer class.

| Serializer       | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [Micro API](http://micro-api.org) (included, default) | [Dali Zheng](http://daliwa.li) | A minimal media type for hypermedia APIs. Default. |
| [JSON API](http://jsonapi.org) (included, default) | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch, useful for clients such as [Ember Data](https://github.com/emberjs/data). Default. |


## Networking

Map external input to the dispatcher and map the response to an external output. Using Fortune with a network protocol is optional.

| Implementation   | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| requestListener (included) | [Dali Zheng](http://daliwa.li) | Implements the `requestListener` function for `http.createServer`, compatible with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar middleware frameworks. |
| Koa middleware (included) | [Dali Zheng](http://daliwa.li) | Middleware that wraps around the `requestListener` for use with the [Koa](http://koajs.com/) framework. |
