# Components

Fortune comes with some defaults to work out of the box, there are alternatives to the defaults.


## Adapters

Adapters must subclass and implement the Adapter superclass (which is really just an interface). The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included) | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |


## Serializers

Serializers process data, they must subclass and implement the Serializer superclass.

| Serializer       | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [JSON API](http://jsonapi.org) (included) | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch, useful for clients such as [Ember Data](https://github.com/emberjs/data). Default. |


## Networking

Map external input to the dispatcher and map the response to an output. Using Fortune with a network protocol is optional.

| Implementation   | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| requestListener (included) | [Dali Zheng](http://daliwa.li) | Implements the `requestListener` function for `http.createServer`. |
