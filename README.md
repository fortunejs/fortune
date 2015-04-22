[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com/)

**Fortune** is a framework for [data-driven applications](https://groups.drupal.org/node/143074). It provides [workflows](https://en.wikipedia.org/wiki/Workflow) for manipulating data.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Motivation

The goal is to provide an integrated system for automating data manipulation given a set of models that conform to [some limitations](https://github.com/fortunejs/fortune/blob/rewrite/lib/index.js#L113). Fortune provides generic features of web applications, or *skins around databases* if you're a hater. It is intended to be used standalone or composed within Node.js web frameworks (Koa, Express, Hapi, etc).


## Key Concepts

- The **dispatcher** controls the flow of a request through middleware functions that mutate state.
- There are two components that are interchangeable: the **adapter** and the **serializer**. Adapters interact with data storage, and serializers parse requests and render responses.
- Networking is optional, and may be handled by serializers.


## Example

Here is how to get started:

```js
import Fortune from 'fortune'
import http from 'http'

const app = new Fortune()
const listener = Fortune.net.requestListener.bind(app)
const server = http.createServer(listener)
```

This sets up an instance of Fortune with default options, as well as a request listener which is used to start an HTTP server instance.

```js
app.defineModel('user', {
  name: { type: String },
  groups: { link: 'group', isArray: true, inverse: 'members' }
})

app.defineModel('group', {
  name: { type: String },
  members: { link: 'user', isArray: true, inverse: 'group' }
})
```

Defining data models. There is a many-to-many relationship between `user` and `group` on the `groups` and `members` fields respectively.

```js
app.initialize().then(() => server.listen(1337))
```

Finally we need to call `initialize` before we do anything with the instance, since the setup is not declarative. This yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and a custom implementation of [Micro API](http://micro-api.org) specification. By default, it is backed by an in-memory database, NeDB.


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
