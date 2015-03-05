# Components

Fortune comes with some defaults to work out of the box, namely the NeDB adapter, JSON API serializer, and requestListener function.


## Adapters

Adapters must subclass and implement the contracts of the Adapter superclass. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the contract. They are responsible for interpreting the options and schemas provided to it.

| Adapter          | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included) | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |


## Serializers

Serializers format data in and out of a Fortune app. Like adapters, they must subclass and implement the contracts of the Serializer superclass. Serializers are responsible for interpreting and displaying media types such as JSON. They may also be concerned with routing requests, though this is optional.

| Serializer       | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [JSON API](http://jsonapi.org) (included) | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch, useful for clients such as [Ember Data](https://github.com/emberjs/data). Default. |


## Networking

Map network requests into Fortune requests. Using Fortune with a network protocol is optional.

| Implementation   | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| requestListener (included) | [Dali Zheng](http://daliwa.li) | A bare-bones function that takes `request` and `response` parameters, useful for `http.createServer`. |
