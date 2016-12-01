# Guide

*This guide assumes familiarity with Node.js, JavaScript, and databases, and is intended to show how to use Fortune.js effectively.*

Fortune.js is a database abstraction layer for Node.js and web browsers. It makes assumptions about the data model in order to build features on top of those assumptions:

- **Inverse relationship updates**: when using links in the definition of a record type, Fortune.js will automatically write the other side of the link.
- **Referential integrity**: Fortune.js ensures that all links must be valid at the application level.
- **Type validation**: fields are guaranteed to belong to a single type.
- **Adapter interface**: any database driver that can implement the Adapter abstract base class can work with Fortune.js.

The only required input of Fortune.js are *record types*, which are analogous to a `struct` in C-like languages. Record types guarantee that fields must belong to a single type or that they are links. The valid types are native JavaScript types including `Buffer` from Node.js, and custom types may extend one of the native types. A link must refer to an ID belonging to a single record type. Both types and links may be defined as arrays or singular values.

Links in record type fields are just primitive values that correspond to the ID of a record in a collection. What is special about links is that Fortune.js automatically manages both sides of the relationship. Writing a link on a record will cause other records to be written as well.

Here is a basic example of record type definitions, which may model a micro-blogging service:

```js
const fortune = require('fortune')

const recordTypes = {
  post: {
    text: String,
    createdAt: Date,
    replies: [ Array('post'), 'parent' ],
    parent: [ 'post', 'replies' ],
    author: [ 'user', 'posts' ]
  },
  user: {
    name: String,
    password: Buffer,
    salt: Buffer,
    posts: [ Array('post'), 'author' ],
    following: [ Array('user'), 'followers' ],
    followers: [ Array('user'), 'following' ]
  }
}

const store = fortune(recordTypes)
```

This is already very close to a working web application. The rest of this guide will focus on all of the parts which are relevant for building this hypothetical application.


## Adapter Interface

By default, Fortune.js uses an in-memory database. While this is fine for development purposes, it will not scale beyond a single thread nor will it persist data. What Fortune.js provides is an abstract base class for dealing with the database called the `Adapter`. To use an adapter, it must be specified. For example, using the Postgres adapter:

```js
const pgAdapter = require('fortune-postgres')

const adapter = [ pgAdapter, {
  // In this example, the Postgres adapter requires the connection URL.
  url: 'postgres://postgres@localhost:5432/app_db'
} ]

const store = fortune(recordTypes, { adapter })
```

The adapter must implement the create, find, update, and delete methods. The find method specifies basic querying options, such as sorting, matching, ranges, existence, sparse fields, limit and offset. An adapter may optionally implement more adapter-specific queries, as well as transactions. In this case, the Postgres adapter implements transactions, so that each request to Fortune.js is atomic.


## Internationalization

In most real world applications, data must be validated for errors. Fortune.js exposes its own error classes and the `message` function to help translate errors to status codes and localized text. All of the error messages that Fortune.js uses internally and exposes to clients may be localized, and custom error messages may be specified like so:

```js
const { message } = fortune

// Add application error messages in English (default language).
// More languages can be defined as keys on the `message` function.
Object.assign(message.en, {
  'InvalidAuthorization': 'The given user and/or password is invalid.',
  'InvalidPermission': 'You do not have permission to do that.',
  'MissingField': 'The required field "{field}" is missing.'
})
```


## Input and Output Hooks

Input and output hooks are user-defined functions which are run before writing a record, and after reading a record. They exist merely for convenience, one could also override the `request` method to implement the same functionality. These hooks are intended to isolate business logic, and any errors thrown here may be mapped to status codes. They may be specified like so:

```js
const hooks = {
  user: [ userInput, userOutput ],
  post: [ postInput ]
}

const store = fortune(recordTypes, { hooks })
```

All of the arguments for the I/O hooks may be mutated. Any custom errors thrown will be displayed to client, while operational errors will be hidden (native errors such as `Error`).

For example, dealing with input for the `user` record type, a variety of authorization cases need to be handled. When creating a user, the name and password fields must be checked and the password must be encrypted, while updating and deleting require an authorization check.

```js
const { methods, errors: { BadRequestError } } = fortune

function userInput (context, record, update) {
  const { request: { method, meta: { language } } } = context

  switch (method) {
  case methods.create:
    // Check for required fields.
    for (const field of [ 'name', 'password' ])
      if ((!field in record)) throw new BadRequestError(
        message('MissingField', language, { field }))

    const { name, password } = record
    return Object.assign({ name }, makePassword(password))

  case methods.update:
    return validateUser(context, update.id).then(() => {
      if (update.replace) {
        // Only allow updates to name and password.
        const { replace: { name, password } } = update
        update.replace = { name }
        if (password) Object.assign(update.replace, makePassword(password))
      }

      // Only allow push/pull updates to follow and unfollow.
      if (update.push) update.push = { following: update.push.following }
      else if (update.pull) update.pull = { following: update.pull.following }
    })

  case methods.delete:
    return validateUser(context, record.id)
  }
}
```

The password hashing function is an implementation detail. In this example, a hash function is used for the sake of simplicity, though a key derivation function or stronger should be used in real applications.

```js
const hashAlgorithm = 'SHA256'

function makePassword (string) {
  const salt = crypto.randomBytes(32)
  const password = crypto.createHash(hashAlgorithm)
    .update(salt).update('' + string).digest()

  return { salt, password }
}
```

The `validateUser` function is an implementation detail which may be shared across other hooks. For stateless protocols such as HTTP, the request parameters should contain all of the information necessary to make the request, including authorization credentials.

```js
const crypto = require('crypto')

const { errors: { UnauthorizedError, ForbiddenError } } = fortune

function validateUser (context, userId) {
  const {
    request: { meta: { headers: { authorization }, language } },
    response: { meta }
  } = context

  // Parse HTTP Basic Access Authentication.
  const [ userId, password ] = atob(authorization.split(' ')[1]).split(':')

  if (!userId || !password) {
    if (!meta.headers) meta.headers = {}
    meta.headers['WWW-Authenticate'] = 'Basic realm="App name"'
    throw new UnauthorizedError(message('InvalidAuthorization', language))
  }

  const options = { fields: { password: true, salt: true } }

  return store.adapter.find('user', [ userId ], options).then(result => {
    const [ user ] = result
    const error = new ForbiddenError(message('InvalidPermission', language))

    if (!user || (userId && userId !== user.id)) throw error

    const hash = crypto.createHash(hashAlgorithm)
      .update(user.salt).update(password).digest()

    // Prefer a constant-time equality check, this is not secure.
    if (!hash.equals(user.password)) throw error

    return user
  })
}
```

When reading a user, the password and salt must not be exposed. This can be done in the output hook:

```js
function userOutput (context, record) {
  delete record.password
  delete record.salt
}
```

The `post` type only needs to check for validity and whitelist fields that may be written.

```js
function postInput (context, record, update) {
  const { request: { method, meta: { language } } } = context

  switch (method) {
  case methods.create:
    const { text, parent } = record
    return validateUser(context).then(user => ({
      text, parent, createdAt: new Date(), author: user.id
    }))

  case methods.update:
    throw new ForbiddenError(message('InvalidPermissions', language))

  case methods.delete:
    return validateUser(context, record.author)
  }
}
```


## Networking

All networking is external to Fortune.js. It makes no assumption that there is even a network at all. This makes it feasible to write applications which are decoupled from the network protocol.

There is a `fortune-http` package which maps requests and responses from the listener function arguments in Node.js to Fortune.js. What it does is implement relevant parts of the HTTP protocol such as content negotiation, status codes, caching and encoding. In the example above, error classes are used, and each error class maps to a status code.

A few basic serializers are included. To use it:

```js
const http = require('http')
const fortuneHTTP = require('fortune-http')

const listener = fortuneHTTP(store, {
  // The order specifies priority of media type negotiation.
  serializers: [
    fortuneHTTP.JsonSerializer,
    fortuneHTTP.HtmlSerializer,
    fortuneHTTP.FormDataSerializer,
    fortuneHTTP.FormUrlEncodedSerializer
  ]
})

const server = http.createServer((request, response) =>
  listener(request, response)
  .catch(error => { /* error logging */ }))

server.listen(1337)
```

There is also a `fortune-ws` package, which may be useful for real-time updates. It implements a wire protocol that uses MessagePack as a serialization format.

Suppose that new posts from users who are followed should be sent. The client must initiate a state change containing users to follow, so that the server knows which posts to send.

```js
const fortuneWS = require('fortune-ws')

const options = { port: 1337 }
const server = fortuneWS(store, (state, changes) => {
  // Whitelist state changes.
  if (!changes) return { users: Array.isArray(state.users) ? state.users : [] }

  // Only send new posts from users that are being followed.
  if (changes[methods.create] && changes[methods.create].post) {
    const post = state.users ? changes[methods.create].post
      .filter(post => ~state.users.indexOf(post.author)) : []

    if (post.length) return { [methods.create]: { post } }
  }
}, options)
```

A web client can listen for changes:

```js
const client = new WebSocket(...)
const users = [ ... ]

fortuneWS.request(client, null, { users })
.then(() => fortuneWS.sync(client, store))
```


## Philosophy

Most web applications are like skins around databases. Fortune.js provides an abstraction around core functionality of web applications. It is designed as a library which adds useful features on top of databases.

It avoids the Object-Relational or Object-Document Mapping problem by not dealing with *objects* in the Object-Oriented Programming sense. Records in Fortune.js do not inherit any classes and are just plain data structures.

It targets Node.js and web browsers with the same codebase, since the same concepts apply in both environments.
