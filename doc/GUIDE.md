# Guide

*This guide assumes familiarity with Node.js, JavaScript, and databases, and is intended to show how to use Fortune.js effectively.*

Fortune.js is a database abstraction layer for Node.js and web browsers. It makes assumptions about the data model in order to build features on top of those assumptions:

- **Inverse relationship updates**: when using links in the definition of a record type, Fortune.js will automatically write the other side of the link.
- **Referential integrity**: Fortune.js ensures that all links must be valid at the application-level.
- **Type validation**: fields are guaranteed to belong to a single type.
- **Adapter interface**: any database that can implement the Adapter abstract base class can work with Fortune.js.

The only required input of Fortune.js are *record types*, which are analogous to a `struct` in C-like languages. Record types guarantee that fields must belong to a single type or that they are links. The valid types are native JavaScript types including `Buffer` from Node.js, and custom types may extend one of the native types. A link must refer to an ID belonging to a single record type. Both types and links may be defined as arrays or singular values.

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
    createdAt: Date,
    posts: [ Array('post'), 'author' ],
    following: [ Array('user'), 'followers' ],
    followers: [ Array('user'), 'following' ]
  }
}

const store = fortune(recordTypes)
```

This is already very close to a working web application. The rest of this guide will focus on all of the parts which are relevant for building this hypothetical application.


## Adapter Interface

By default, Fortune.js ships with an in-memory database. While this is fine for development purposes, it will not scale beyond a single thread nor will it persist data. What Fortune.js provides is an abstract base class for dealing with the database called the `Adapter`. To use an adapter, it must be specified. For example, using the Postgres adapter:

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
  'InvalidAuthorization: 'The given user and/or password is invalid.',
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

All of the arguments for the I/O hooks may be mutated. Any custom errors thrown will be displayed to client, while operational errors will be hidden (native errors such as `Error`). For example, dealing with input for the `user` record type:

```js
const { methods } = fortune

function userInput (context, record, update) {
  const { request: { method } } = context

  return validateUser(context).then(() => {
    switch (method) {
    case methods.create:
      return {
        name: record.name,
        createdAt: new Date()
      }
    }
  })
}
```

The `validateUser` function is an implementation detail which may be shared across other hooks. For stateless protocols such as HTTP, the request parameters should contain all of the information necessary to make the request, including authorization credentials.

```js
const crypto = require('crypto')

const { errors: { UnauthorizedError, ForbiddenError } } = fortune

function validateUser (context) {
  const {
    request: { meta: { userId, password, language } },
    response: { meta }
  } = context

  if (!userId || !password) {
    meta.headers['WWW-Authenticate'] = 'Basic realm="App name"'
    throw new UnauthorizedError(message('InvalidAuthorization', language))
  }

  const options = { fields: { password: true, salt: true } }
  const error = new ForbiddenError(message('InvalidPermission', language))

  return store.adapter.find('user', [ userId ], options).then(result => {
    const [ user ] = result

    if (!user) throw error

    return Promise.all([
      // Hash passwords
    ])
  })
}
```
