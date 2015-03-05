[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com/)

**Fortune.js** is a [composable](https://en.wikipedia.org/wiki/Composability) framework for [data-driven applications](https://groups.drupal.org/node/143074). It provides a workflow that integrates database adapters and serializers, with networking as an optional, thin layer on top.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune
```

## Key Concepts

At the core of Fortune is the **dispatcher**, which accepts a `request` object, and returns a `response` object. At intermediate states of a request, a `context` object that encapsulates the request and response is mutated. Control is passed through middleware functions depending on the request.

There are two required components that are pluggable: the **adapter** and the **serializer**. Each Fortune instance may have only one database adapter, and multiple serializers. Both of these components must subclass and implement the contracts described by their respective superclasses.

Fortune itself is *agnostic* about networking. The responsibility of parsing protocol-specific parameters may be delegated to serializers which may mutate the request based on arbitrary arguments. There is a basic `requestListener` function for HTTP included for convenience.

## Example

Implementers do not need to know much of its internal workings to get started. Here is a basic CRUD example:

```js
import Fortune from 'fortune';
import http from 'http';

new Fortune()

.model('user', {
  name: String,
  group: { link: 'group', inverse: 'members' }})

.model('group', {
  name: String,
  members: { link: ['user'], inverse: 'group' }})

.initialize().then(app => {
  let listener = Fortune.net.requestListener.bind(app);
  let server = http.createServer(listener);
  let port = process.env.PORT || 1337;

  server.listen(port);
  console.log(`Fortune is listening on port ${port}...`);
});

```

This yields a HTTP API that conforms to [JSON API](http://jsonapi.org), and backed by an in-memory database. Authorization is left as an exercise to the implementer.

## Contributing

The [main repository is on GitHub](https://github.com/fortunejs/fortune). Fork it, install development dependencies with `npm install`, commit changes, make sure the code lints and the tests pass by running `npm test`, and submit a pull request.

## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
