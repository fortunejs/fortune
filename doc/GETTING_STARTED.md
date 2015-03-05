## Getting Started

Fortune should work out of the box with no configuration using the defaults. For example:

```js
import http from 'http';
import Fortune from 'fortune';

new Fortune();

.resource('user', {
  name: String,
  createdAt: Date
})

.init().then(app => {
  let listener = Fortune.net.requestListener.bind(app);
  let server = http.createServer(listener);

  server.listen(1337);
});
```
