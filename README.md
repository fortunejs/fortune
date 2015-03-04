<a href="http://fortunejs.com">
  <img alt="Fortune.js" src="https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg" width="280">
</a>

**Fortune.js** is a composable framework for data-driven applications. It provides a workflow for database adapters and serializers, with networking as a thin layer on top.

[View the website](http://fortunejs.com) for documentation.

## Key Concepts

At the core of Fortune is the **dispatcher**, which accepts a `request` object, and returns a `response` object. At intermediate states of a request, a `context` object that encapsulates the request and response is mutated. Control is passed through middleware functions depending on what is in the request.

There are two components that are entirely pluggable, the **adapter** and **serializer**. Each Fortune instance may only have one database adapter, and multiple serializers. Both of these components must subclass and implement the contracts described by their respective superclasses.

Fortune itself is *agnostic* about networking. A network layer is expected to be minimally responsible for making requests and sending responses. The responsibility of routing, parsing protocol parameters, may be delegated to serializers which may mutate the request based on additional arguments. There is a basic `requestListener` function for HTTP included for convenience.

## Example

```js
import Fortune from 'fortune';
import http from 'http';

new Fortune()

.model('user', {
  firstName: String, lastName: String,
  group: { link: 'group', inverse: 'members' }})
.after((context, entity) => {
  entity.fullName = `${firstName} ${lastName}`;
  return entity;
})

.model('group', {
  name: String,
  members: { link: ['user'], inverse: 'group' }})

.init().then(app => {
  let listener = Fortune.net.requestListener.bind(app);
  let server = http.createServer(listener);
  let port = process.env.PORT || 1337;

  server.listen(port);
  console.log(`Fortune is listening on port ${port}...`);
});

```

This yields a basic CRUD API with users and groups that conforms to JSON API, and backed by NeDB, an embedded database. Authorization is left as an exercise to the implementer.

## Contributing

The [main repository is on GitHub](https://github.com/fortunejs/fortune). Fork it, install development dependencies with `npm install`, commit changes, make sure the code lints and the tests pass by running `npm test`, and submit a pull request.

## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
