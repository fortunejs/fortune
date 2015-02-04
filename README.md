# Fortune.js [![Build Status](https://travis-ci.org/fortunejs/fortune.png?branch=rewrite)](https://travis-ci.org/fortunejs/fortune)

Fortune is a framework for hypermedia applications. It provides a system of database adapters, serializers, and asynchronous I/O which can be exposed using protocols such as HTTP. A baseline of defaults are included: [Node Embedded Database (NeDB)](https://github.com/louischatriot/nedb) adapter, [JSON API](http://jsonapi.org) serializer, and HTTP server.

The purpose is to provide an adequate abstraction for a networked application server in the same spirit as Rails, Sails, Django, et al. but with a focus on building robust applications using hypermedia.

Get it by installing from npm:
```
$ npm install --save fortune
```


### Adapters

Adapters belong to class that must implement a baseline of `init`, `create`, `find`, `update`, and `delete` methods. These methods have well-defined parameters and return values. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the adapter methods. They are also responsible for interpreting the options and schemas provided to it.


| Adapter          | Maintainer     | Description                             |
|------------------|----------------|-----------------------------------------|
| NeDB | [Dali Zheng](http://daliwa.li) | Embedded data store. Default. |


### Serializers

Serializers format data in and out of a Fortune app. Like adapters, they belong to a class that implements a baseline of methods with well-defined parameters and return values. Serializers are responsible for interpreting and displaying media types such as JSON. They are not concerned with any protocol, so it is not guaranteed that they will output links that are consistent with any router.

| Serializer       | Maintainer     | Description                             |
|------------------|----------------|-----------------------------------------|
| JSON API | [Dali Zheng](http://daliwa.li) | Tracking latest JSON API master branch. Default. |


### Input / Output

Internally, Fortune uses a request and response model much like how HTTP operates. Like the adapter and serializer, it also has well-defined parameters and return values. Users of Fortune should not have to care about this layer unless they want to implement how it maps to a protocol.

| Implementation   | Maintainer     | Description                             |
|------------------|----------------|-----------------------------------------|
| Node.js `requestListener` | [Dali Zheng](http://daliwa.li) | A function that takes `request` and `response` parameters. Included as `Fortune.Net.requestListener`. |


### Philosophy

The earliest concept of hypermedia was a [mechanical device that created trails of links between microfilms](https://en.wikipedia.org/wiki/Memex). It wasn't until 1965 that Ted Nelson [coined the term "hypermedia"](http://www.historyofinformation.com/expanded.php?id=1055) as a digital system of hyperlinks and media. Fast forward to today and we have the world wide web, and along with it, [HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol), [REST](https://en.wikipedia.org/wiki/Representational_state_transfer), etc. [Hypertext](https://en.wikipedia.org/wiki/Hypertext) provides a fundamental layer of understanding which REST builds upon. RESTful services resemble web pages in that links are present in the media, which a client can discover and follow. This promotes decoupling of server and client, and discovery of new information.

> "REST is software design on the scale of decades: every detail is intended to promote software longevity and independent evolution. Many of the constraints are directly opposed to short-term efficiency." -- Roy T. Fielding

Building hypermedia APIs is hard. If it wasn't hard then everyone would be doing it already. Fortune aims to present simple options for those who wish to build hypermedia APIs.


### Meta

For release history, see [CHANGELOG.md](https://github.com/daliwali/fortune/blob/master/CHANGELOG.md).

For internal implementation, see [ARCHITECTURE.md](https://github.com/daliwali/fortune/blob/master/ARCHITECTURE.md)

Fortune is licensed under the MIT License, see [LICENSE.md](https://github.com/daliwali/fortune/blob/master/LICENSE.md).
