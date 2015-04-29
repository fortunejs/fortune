[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/rewrite.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![Piggu](https://img.shields.io/badge/pigs-flying-fca889.svg?style=flat-square)](http://fortunejs.com)

**Fortune** is a data manipulation library, intended to provide building blocks for [data-driven web applications](https://groups.drupal.org/node/143074). It provides basic [workflows](https://en.wikipedia.org/wiki/Workflow) for manipulating data.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Motivation

Fortune provides generic features (mostly [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) and [serialization](https://en.wikipedia.org/wiki/Serialization)) intended to be used in web applications, or [*skins around databases*](https://www.reddit.com/r/programming/comments/1a2mf7/programming_is_terriblelessons_learned_from_a/c8tjzl5) for the haters. The goal is to provide a system for automating data manipulation given a set of models that conform to [some limitations](https://github.com/fortunejs/fortune/blob/rewrite/lib/index.js#L113-L150). It is intended to be used standalone or composed within Node.js web frameworks (Koa, Express, Hapi, etc).


## Key Concepts

- Stateless request and response workflow.
- Two interchangeable components: the **adapter** and the **serializer**.
- The adapter interacts with data storage.
- Serializers parse requests and render responses.
- Networking is optional, may be handled by serializers.


## Example

Here is how to get started, including a web server implementation:

```js
import fortune from 'fortune'
import http from 'http'

const app = fortune.create()
const listener = fortune.net.requestListener.bind(app)
const server = http.createServer(listener)
```

This sets up an instance of Fortune with default options, a request listener bound to the instance, and an HTTP server instance. The `requestListener` does content negotiation to determine which serializers to use for I/O, and forwards Node's built-in `request` and `response` objects to the serializers.

```js
app.defineType('user', {
  name: { type: String },
  groups: { link: 'group', isArray: true, inverse: 'members' }
})

app.defineType('group', {
  name: { type: String },
  members: { link: 'user', isArray: true, inverse: 'group' }
})
```

Defining record types. There is a many-to-many relationship between `user` and `group` on the `groups` and `members` fields respectively.

```js
app.initialize().then(() => server.listen(1337))
```

Finally we need to call `initialize` before we do anything with the instance. Then we can let the server listen, which yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and a custom implementation of [Micro API](http://micro-api.org) specification. By default, it is backed by an embedded datastore, NeDB (which doesn't persist to disk by default).


## Hypermedia Applications

Fortune gives you a few hypermedia serializers for free. Given the definitions of the record types, it is able to construct a [domain ontology](https://en.wikipedia.org/wiki/Ontology_(information_science)#Domain_ontology). This is useful for generating hyperlinks to entities that compose records and their relationships.


## Design Considerations

Fortune enforces an undirected graph of relationships, for a few reasons:

- An undirected graph makes it impossible to reach an orphan node without *a priori* knowledge. See [deep hypertext in Xanadu](http://xanadu.com/xuTheModel/) for the concept behind this.
- Showing relationships is more performant since there is no querying to be done, but writing relationships is slower depending on the amount of related records.
- Undirected graphs are simpler to implement and easier to understand.

This is a tradeoff that sacrifices flexibility and complicates [referential integrity](https://en.wikipedia.org/wiki/Referential_integrity) in favor of visibility. The design also eliminates any guarantees of referential integrity in databases that do not support transactions. It could be modified to support directed graphs however.


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
