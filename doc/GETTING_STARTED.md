## Getting Started

Fortune should work out of the box with no configuration using the defaults. For example:

```js
import http from 'http';
import Fortune from 'fortune';

let app = new Fortune();

app.resource('user', {
  name: String,
  createdAt: Date
});

app.init().then(() => {
  http.createServer(Fortune.Net.requestListener.bind(app))
  	.listen(1337);
});
```
