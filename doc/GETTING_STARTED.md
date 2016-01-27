# Getting Started

The first concern of Fortune.js is data modeling, which is structured as record types. Fields may be either a type or link field. A typed field may belong to some of the JavaScript and Node.js native types: `String`, `Number`, `Boolean`, `Object`, `Array`, or `Buffer`. A link field establishes a reference to an ID belonging to a record, and its type is determined by the Adapter. For example:

```js
const fortune = require('fortune')

const store = fortune({
  user: {
    name: { type: String },
    password: { type: Buffer },
    salt: { type: Buffer },
    group: { link: 'group', inverse: 'users', isArray: true }
  },
  group: {
    name: { type: String },
    users: { link: 'user', inverse: 'group', isArray: true }
  }
})
```

This defines a `user` record type that has a link field to the `group` type. By default, link fields are to-one, unless `isArray` is specified. In this example, there is a many-to-many relationship between a user and a group. The `inverse` field specifies a corresponding field on the linked type, so that any update to either field will affect the other (two-way binding). If an inverse is not specified, an internal field will be created automatically.


## Transform Functions

Transform functions isolate business logic. An input and output transform function may be defined per record type. Transform functions accept at least two arguments, the `context` object, the record, and optionally the `update` object for an `update` request. The method of an input transform may be any method except `find`, and an output transform may be applied on all methods.

The return value of an input transform function determines what gets persisted, and it should be safe to mutate any of its arguments. It may return either the value or a Promise, or throw an error. For example, an input transform function for a record may look like this:

```js
function input (context, record, update) {
  // If it's a create request, return the record.
  if (context.request.method === 'create') return record

  // If the update argument exists, it's an update request.
  if (update) return update

  // Otherwise, it's a delete request and the return value doesn't matter.
  return null
}
```

An output transform function may only return a record or Promise that resolves to a record, or throw an error. It should be safe to mutate any of its arguments.

```js
function output (context, record) {
  record.accessedAt = new Date()
  return record
})
```

Based on whether or not the resolved record is different from what was passed in, serializers may decide not show the resolved record of the output transform for update and delete requests.


## Configuration

Fortune.js comes with defaults to work out of the box, but they are probably not suitable for real world applications. Consult the [plugins page](http://fortunejs.com/plugins/) for more information.
