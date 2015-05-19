# Getting Started

*This guide is written with absolute beginners to JavaScript / Node.js in mind. If you're feeling confident, skip to the API reference.*

Fortune provides generic features (mostly [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) and [serialization](https://en.wikipedia.org/wiki/Serialization)) intended to be used in web applications, or [*skins around databases*](https://www.reddit.com/r/programming/comments/1a2mf7/programming_is_terriblelessons_learned_from_a/c8tjzl5) for the haters. The goal is to provide data persistence and manipulation given a set of models that conform to [some limitations](https://github.com/fortunejs/fortune/blob/rewrite/lib/index.js#L134-L171). It is intended to be used standalone or composed within Node.js web frameworks (Express, Connect, Koa, etc).

The first thing you'll have to do is install [Node.js](https://nodejs.org/) (if you're on Linux, install `nodejs` from your package manager). You will need [Babel](http://babeljs.io) to run ES6 code:

```
$ npm install -g babel
```

*Note: if the above did not work, you will probably need root permissions, so try running it with `sudo`.*

Then install Fortune from the command-line:

```
$ npm install fortune
```

This creates a `node_modules` folder with `fortune` in it. Then create an empty `index.js` file, and start with importing things:

```js
import Fortune from 'fortune'
import http from 'http'
```

Using Fortune with HTTP is optional, but since the built-in serializers provide HTTP functionality in conjunction with the `Fortune.net.http` module, it's easy to get started with it. Create an instance of Fortune, along with a HTTP listener function:

```js
const app = new Fortune()
const listener = Fortune.net.http.bind(app)
```

We don't need to pass any arguments to the `Fortune` constructor, the defaults should work. The `net.http` module is a listener function that accepts a `request` and `response` object that is generated by Node.js. It needs to be [bound](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind) to the application in order to work.

