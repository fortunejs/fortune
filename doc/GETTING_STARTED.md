# Getting Started

Fortune provides generic features (mostly [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) and [serialization](https://en.wikipedia.org/wiki/Serialization)) intended to be used in web applications, or [*skins around databases*](https://www.reddit.com/r/programming/comments/1a2mf7/programming_is_terriblelessons_learned_from_a/c8tjzl5) for the haters. The goal is to provide a system for automating data persistence and manipulation given a set of models that conform to [some limitations](https://github.com/fortunejs/fortune/blob/rewrite/lib/index.js#L134-L171). It is intended to be used standalone or composed within Node.js web frameworks (Express, Connect, Hapi, Koa, etc).


## Example

Here is an example application, including a web server implementation:

```js
import Fortune from 'fortune'
import http from 'http'

// If you are in an ES6+ environment, you can import the library directly:
// import Fortune from 'fortune/lib'

const app = new Fortune()
const listener = Fortune.net.requestListener.bind(app)
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
app.start().then(() => server.listen(1337))
```

Finally we need to call `start` before we do anything with the instance. Then we can let the server listen, which yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and a custom implementation of [Micro API](http://micro-api.org) specification. By default, it is backed by an embedded datastore, NeDB (which doesn't persist to disk by default).
