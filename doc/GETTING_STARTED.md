# Getting Started

Fortune provides generic features (mostly [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) and [serialization](https://en.wikipedia.org/wiki/Serialization)) intended to be used in web applications, or [*skins around databases*](https://www.reddit.com/r/programming/comments/1a2mf7/programming_is_terriblelessons_learned_from_a/c8tjzl5) for the haters. The purpose is to provide data persistence and manipulation given a set of models that conform to [some limitations](https://github.com/fortunejs/fortune/blob/rewrite/lib/index.js#L160-L197).

The first thing you'll have to do is install [Node.js](https://nodejs.org/) (if you're on Linux, install `nodejs` from your package manager). You will need [Babel](http://babeljs.io) to run ES6 code:

```
$ npm install -g babel
```

*Note: if the above did not work, you will probably need root permissions, so try running it with `sudo`.*

Then install Fortune from the command-line:

```
$ npm install fortune
```

Then create an empty `index.js` file next to the `node_modules` folder, and start by importing Fortune and creating an instance:

```js
import fortune from 'fortune'

const app = fortune.create()
```

We don't need to pass any arguments to the constructor, the defaults should work. The application must have record types to be useful. Let's start with a basic example:

```js
app.defineType('user', {
  username: { type: String },
  key: { type: Buffer },
  salt: { type: Buffer },
  group: { link: 'group', inverse: 'users', isArray: true }
})

app.defineType('group', {
  name: { type: String },
  users: { link: 'user', inverse: 'group', isArray: true }
})
```

This defines a `user` record type that has a relationship to the `group` type. By default, relationships are to-one, unless `isArray` is specified. In this example, there is a many-to-many relationship between a user and a group. The `inverse` field specifies a corresponding field on the linked type, so that any update to either field will affect the other.

Transformations can be defined per record type. Transform functions accept exactly two arguments, the `context` object, and the record. The record for an input transform may be the record to be created or deleted, or an updated record with updates applied. The method of an input transform may be any method except `find`, and an output transform may be applied to all methods.

```js
import crypto from 'crypto'

const { errors } = fortune
const { methods } = app.dispatcher
const [ iterations, keyLength, saltLength ] =
  [ Math.pow(2, 15), Math.pow(2, 9), Math.pow(2, 6) ]
```

For the user type, it would be a good idea to store the password as a cryptographically secure key, and to hide fields when displaying the record.

```js
app.transformInput('user', (context, record) => {
  const { method, type, meta } = context.request
  const { password, id } = record
  let salt, key

  if (method === methods.create && !password)
    throw new errors.BadRequestError(`Password must be specified.`)

  return new Promise((resolve, reject) => method !== methods.create ?
    // Check if the old password is correct.
    crypto.pbkdf2(
      new Buffer(meta['Authorization'] || '', 'base64').toString(),
      record.salt.toString(), iterations, keyLength, (error, buffer) =>
        error ? reject(error) : record.key.equals(buffer) ? resolve() :
        reject(new errors.UnauthorizedError(`Incorrect password.`)))
    : resolve())

  .then(() => {
    // If we're not updating the password, don't need to do more.
    if (!password || method === methods.delete) return record

    return new Promise((resolve, reject) =>
      // Generate a new salt.
      crypto.randomBytes(saltLength, (error, buffer) =>
      error ? reject(error) : resolve(buffer)))

    .then(buffer => {
      salt = buffer

      return new Promise((resolve, reject) =>
        // Generate secure password key.
        crypto.pbkdf2(password, salt.toString(),
          iterations, keyLength, (error, buffer) =>
          error ? reject(error) : resolve(buffer)))
    })

    .then(buffer => {
      key = buffer

      record.key = key
      record.salt = salt

      if (method === methods.create)
        return record

      return app.adapter.update(type, {
        id, replace: { key, salt }
      })
      .then(() => record)
    })
  })
})
```

Input transform functions are run before anything gets persisted, so it is safe to throw errors. They may either synchronously return a value, or return a Promise. Note that the `password` field on the record is not defined in the record type. Arbitrary fields should be parsed on create and update but not persisted. Updating the password in this example requires a field in the `meta` object, for example `Authorization: "Zm9vYmFyYmF6cXV4"` where the value is the base64 encoded old password.

It may be required to transform outputs as well. In this example, we don't want expose the salt and the key publicly:

```js
app.transformOutput('user', (context, record) => {
  // Hide sensitive fields.
  delete record.salt
  delete record.key

  return record
})
```

The output transform has the same arguments as the input transform, and is applied on `find` and `create` requests only. It must return the record, either synchronously or as a promise.

To start the application, we need to call the `start` method.

```js
import http from 'http'

const listener = fortune.net.http.bind(app)
const server = http.createServer(listener)
const port = 1337

app.start().then(() => {
  server.listen(port)
  console.log(`Server is listening on port ${port}...`)
})
```

Using Fortune with HTTP is optional, but since the built-in serializers provide HTTP functionality in conjunction with the `fortune.net.http` module, it's easy to get started with it. The `fortune.net.http` module is a listener function that accepts a `request` and `response` object that is generated by Node.js. It needs to be [bound](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind) to the application in order to work. The reason why it needs to be bound is that the listener function refers to `this`, which should be a Fortune instance.

Making a cURL request to the server:

```
$ curl -X GET -H "Accept: application/vnd.micro+json" -v http://localhost:1337
```

The response should be the entry point, in [Micro API](http://micro-api.org/#entry-point) format. Every Micro API entity includes hyperlinks, so the API should be mostly self-discoverable.
