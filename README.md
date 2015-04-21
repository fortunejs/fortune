[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com/)

**Fortune** is a framework for [data-driven applications](https://groups.drupal.org/node/143074). It provides a [workflow](https://en.wikipedia.org/wiki/Workflow) for manipulating data, with networking as an thin layer on top.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Motivation

The goal is to automate data manipulation given a set of models that conform to some limitations. Fortune provides generic features of web applications, or *skins around databases* if you're a hater. However, it is not a web framework.


## Key Concepts

- At the core of Fortune is the **dispatcher**, which controls the flow of a request through middleware functions.
- There are two components that are interchangeable: the **adapter** and the **serializer**. Adapters interact with data storage, and serializers parse requests and render responses.
- Networking is optional, and may be handled by serializers. There is a basic `requestListener` function for HTTP that works out of the box, included for convenience.


## Example

Here is how to get started:

```js
import Fortune from 'fortune'
import http from 'http' // Optional, we'll use this later.

const app = new Fortune()
```

This sets up an instance of Fortune with default options.

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
app.initialize().then(() => {
  const listener = Fortune.net.requestListener.bind(app)
  http.createServer(listener).listen(1337)
})
```

It is necessary to call `initialize` before we do anything with the instance, since the setup is not declarative. This yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and [Micro API](http://micro-api.org) specification. By default, it is backed by an in-memory database, NeDB.


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
