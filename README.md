# Fortune.js

Fortune is a framework for hypermedia applications. It provides a system of database adapters, serializers, and asynchronous I/O which can be exposed using protocols such as HTTP. A baseline of defaults are included: [Node Embedded Database (NeDB)](https://github.com/louischatriot/nedb), [JSON API](http://jsonapi.org) serializer, and HTTP server.

The purpose is to provide an adequate abstraction for a networked application server in the same spirit as Rails, Sails, Django, et al. but with a focus on building robust applications using hypermedia.

Get it by installing from npm:
```
$ npm install --save fortune
```

### What is hypermedia and why does it matter?

First, a little history lesson. The earliest concept of hypermedia was a [mechanical device that created trails of links between microfilms](https://en.wikipedia.org/wiki/Memex). It wasn't until 1965 that Ted Nelson [coined the term "hypermedia"](http://www.historyofinformation.com/expanded.php?id=1055) as a digital system of hyperlinks and media. Fast forward to today and we have the world wide web, and along with it, [HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol), [REST](https://en.wikipedia.org/wiki/Representational_state_transfer), etc. [Hypertext](https://en.wikipedia.org/wiki/Hypertext) provides a fundamental layer of understanding which REST builds upon. RESTful services resemble web pages in that links are present in the media, which a client can discover and follow. This promotes decoupling of server and client, and discovery of new information.

> "REST is software design on the scale of decades: every detail is intended to promote software longevity and independent evolution. Many of the constraints are directly opposed to short-term efficiency." -- Roy T. Fielding

### Meta

For release history, see [CHANGELOG.md](https://github.com/daliwali/fortune/blob/master/CHANGELOG.md).

Fortune is licensed under the MIT license, see [LICENSE.md](https://github.com/daliwali/fortune/blob/master/LICENSE.md).
