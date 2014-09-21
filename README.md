# Fortune.js [![Build Status](https://travis-ci.org/daliwali/fortune.png?branch=master)](https://travis-ci.org/daliwali/fortune)

Hello nerds. Fortune is a web framework for prototyping hypermedia APIs that implement the [JSON API](http://jsonapi.org/) specification. It comes with a modular persistence layer, with adapters for [NeDB](//github.com/louischatriot/nedb) (built-in), [MongoDB](//github.com/daliwali/fortune-mongodb), [MySQL](//github.com/daliwali/fortune-relational), [Postgres](//github.com/daliwali/fortune-relational), & [SQLite](//github.com/daliwali/fortune-relational).

Get it by installing from npm:
```
$ npm install fortune
```
Contributions welcome.

### Changes since fork of daliwali/fortune

- Select fields to return: `/people?fields=name,age`  (see [acdb09b](//github.com/flyvictor/fortune/commit/acdb09b2cad568c0dd0e7e27fc22b6362e996f2c))
- Specif express instance in fortune options (see [0413a74](//github.com/flyvictor/fortune/commit/0413a74f3c1a7c9971f8cac4eecf77284503e2f1))
- Control if linked documents are included in the response `/people?include=pets` (see [92c80f3](//github.com/flyvictor/fortune/commit/92c80f3b8363242a8cb57a33e20f6d4b57a04055))
- Simple filter: `/people?filter[prop]=value` (see [d3cea1c](//github.com/flyvictor/fortune/commit/d3cea1ca4a48863b82ef5b98a2ff5b3b5cbc986a))
- Filter by id: `/people?filter[pets]=23` (see [798e871](//github.com/flyvictor/fortune/commit/798e87122af11ee462252e0b525d4365ce9bdd3a))
- Subdoc filter: `/people?filter[subdoc.prop]=value` (see [37b17ba](//github.com/flyvictor/fortune/commit/37b17bacc165f7b66475881f11a68a07520386d0))
- Metadata/Schema `/resources` (see [b1ac88f](//github.com/flyvictor/fortune/commit/b1ac88f234ce58daac182de6e4d4e4c57c3353db) && [eaa5661](//github.com/flyvictor/fortune/commit/eaa56610e67c45fb17752d0905e6a298878f6d99))
- Hooks like .beforeWrite, .afterRead, .beforeAll, ... (see [1df41c0](//github.com/flyvictor/fortune/commit/1df41c0dd5800acba77bd0a3a9820cd855587c33) && [a0b3fa6](//github.com/flyvictor/fortune/commit/a0b3fa639067b937e23aec671fdb014c3ea2a8b3) && [c877afa](//github.com/flyvictor/fortune/commit/c877afaea26a4fdd34b06ce9b6ca2bf510a4a01d))
- Extended filter: lt, gt, lte, gte `/people?filter={birthday:{lt:'2000-02-02',gte: '1900-02-02'}}` (see [30a5462](//github.com/flyvictor/fortune/commit/30a54625f27e76bc4b90ef519011585e7e3bd103))
- Filter by regex, multiple filters and filter by related resource fields `/pets?filter[owner][name][regex]=ally&filter[owner][soulmate]=55` (see [c2910f1](//github.com/flyvictor/fortune/commit/c2910f139175b16abdc5b2d8707bc8b86ad1321a))
- Filter $in support `/people?filter[houses][in]=53,67,88` (see [63ec0cb](//github.com/flyvictor/fortune/commit/63ec0cbe747beeeff0425605048c5aedb411bcbf))
- Limit result set `/people?limit=10` (see [0032589](//github.com/flyvictor/fortune/commit/0032589b8e7ed460c5eac197bf68159b7403ac43))
- Sorting and pagination `/people?sort=name&page=2&pageSize=2` (see [4a725de](//github.com/flyvictor/fortune/commit/4a725de28e437008e12d5cb2e5dcac44e98ff747))
- AND / OR for filters `/people?filter[or][0][name]=Dilbert&filter[or][1][email]=robert@mailbert.com&sort=name` (see [5c97137](//github.com/flyvictor/fortune/commit/5c971372cd75d75fe9fcc68023593c5e4c8604a9))
- Pass $-prefixed query modificators to db (see [434bcb2](//github.com/flyvictor/fortune/commit/434bcb2aaab19c115e2d3af614861f1254bf5294))

This is not a complete list but it should cover most of the changes. There may also be more commits which are not linked here. I recommend looking at the tests and commit log if you are unsure on how to use these features.


### Features

Fortune implements everything you need to get started with JSON API, with a few extra features:

- Batteries included, Fortune handles routing and database interactions so you don't have to.
- Serializers and deserializers for JSON API, and other hypermedia formats (in the future).
- Hooks to implement application specific logic before/after interacting with resources.

It does not come with any authentication or authorization, you should implement your own application-specific logic (see [keystore.js](//github.com/daliwali/fortune/blob/master/examples/keystore.js) for an example).

## Guide & Documentation

The full guide and API documentation are located at [fortunejs.com](http://fortunejs.com/).

### Basic Usage

Here is a minimal application:

```javascript
var fortune = require('fortune');
var app = fortune();

app.resource('person', {
  name: String,
  age: Number,
  pets: ['pet'] // "has many" relationship to pets
});

app.resource('pet', {
  name: String,
  age: Number,
  owner: 'person' // "belongs to" relationship to a person
});

app.listen(1337);
```

This exposes a few routes for the `person` and `pet` resources, as defined by the JSON API specification:

| HTTP   | Person             | Pet               | Notes                                                        |
|--------|--------------------|-------------------|--------------------------------------------------------------|
| GET    | /people            | /pets             | Get a collection of resources, accepts query `?ids=1,2,3...` |
| POST   | /people            | /pets             | Create a resource                                            |
| GET    | /people/`:id`      | /pets/`:id`       | Get a specific resource, or multiple: `1,2,3`                |
| PUT    | /people/`:id`      | /pets/`:id`       | Create or update a resource                                  |
| PATCH  | /people/`:id`      | /pets/`:id`       | Patch a resource (see [RFC 6902](//tools.ietf.org/html/rfc6902)) |
| DELETE | /people/`:id`      | /pets/`:id`       | Delete a resource                                            |
| GET    | /people/`:id`/pets | /pets/`:id`/owner | Get a related resource (one level deep)                      |

### Unit Testing

Tests are written with Mocha, and are run against the built-in NeDB adapter, plus MongoDB & MySQL on Travis. You will also need to have the developer dependencies installed. To run tests:

```
$ npm test
```

### Client-side Implementations
- [Ember Data](//github.com/emberjs/data): the original implementation, it needs a [custom adapter](//github.com/daliwali/ember-json-api) to actually work.

### Meta

For release history and roadmap, see [CHANGELOG.md](//github.com/daliwali/fortune/blob/master/CHANGELOG.md).

Fortune is licensed under the MIT license, see [LICENSE.md](//github.com/daliwali/fortune/blob/master/LICENSE.md).
