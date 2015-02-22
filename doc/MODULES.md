# Modules

Fortune comes with some defaults to work out of the box, namely the NeDB adapter, JSON API serializer, and requestListener function.


## Adapters

Adapters belong to class that must implement a baseline of methods that have well-defined parameters and return values. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the adapter methods. They are responsible for interpreting the options and schemas provided to it.

| Adapter          | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| NeDB (included, [link](https://github.com/louischatriot/nedb)) | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |


## Serializers

Serializers format data in and out of a Fortune app. Like adapters, they belong to a class that implements a baseline of methods with well-defined parameters and return values. Serializers are responsible for interpreting and displaying media types such as JSON. They may also be concerned with routing requests, though this is optional.

| Serializer       | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| JSON API (included, [link](http://jsonapi.org)) | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch, useful for clients such as [Ember Data](https://github.com/emberjs/data). Default. |


## Networking

Internally, Fortune uses a request and response model much like how HTTP operates. Like the adapter and serializer, it also has well-defined parameters and return values. Users of Fortune should not have to care about this layer unless they want to implement how it maps to a protocol or external framework. Using Fortune over a network protocol is optional.

| Implementation   | Maintainer     | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| requestListener (included) | [Dali Zheng](http://daliwa.li) | A bare-bones function that takes `request` and `response` parameters, useful for `http.createServer`. |
