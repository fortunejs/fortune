# Components

Fortune comes with some defaults to work out of the box, and there are alternatives to the defaults.


## Adapters

Adapters must subclass and implement the Adapter class. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included, default) | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |


## Serializers

Serializers process data, they must subclass and implement the Serializer class.

| Serializer       | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [JSON API](http://jsonapi.org) (included, default) | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch, useful for clients such as [Ember Data](https://github.com/emberjs/data). Default. |
| [Micro API](http://micro-api.org) (included, default) | [Dali Zheng](http://daliwa.li) | A minimal media type for hypermedia APIs. Default. |


## Networking

Map external input to the dispatcher and map the response to an external output. Using Fortune with a network protocol is optional.

| Implementation   | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| requestListener (included) | [Dali Zheng](http://daliwa.li) | Implements the `requestListener` function for `http.createServer`. |
