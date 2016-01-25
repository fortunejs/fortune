# Changelog


##### 2.1.0 (2016-xx-xx)
- Feature: implemented application-level wire protocol.


##### 2.0.1 (2016-01-25)
- Polish: improve auto-connection on first request and subsequent requests.


##### 2.0.0 (2016-01-25)
- Breaking change: constructor argument now contains all configuration.
- Breaking change: removed `defineType`, `transform`, `transformInput`, `transformOutput`, and static `create` methods. Deprecated in favor of new constructor object.


##### 1.12.0 (2016-01-24)
- Feature: include entire payloads in change event.
- Fix: update objects should show resulting operations.


##### 1.11.5 (2016-01-24)
- Polish: use `msgpack` to store data in IndexedDB instead of JSON, which allows use of Transferable & ArrayBuffer.
- Polish: improve IndexedDB error handling.


##### 1.11.3 (2016-01-23)
- Polish: replace `Object.keys` with `for..in`.
- Polish: replace `Object.create(null)` with object literal.
- Polish: replace array length assignment with `push`.
- Polish: use `WeakMap`.
- Feature: add `type` field in default JSON serializer.


##### 1.11.2 (2016-01-22)
- Polish: remove JSON from HTTP listener.
- Polish: HTTP listener fixes.


##### 1.10.3 (2016-01-21)
- Polish: use `WeakMap` in HTTP implementation.
- Polish: improve memory filtering.


##### 1.10.1 (2016-01-20)
- Feature: add `exists` object in `find` method in Adapter.
- Fix: improve non-unique check.


##### 1.9.2 (2016-01-19)
- Fix: add a check for non-unique push values on link fields.
- Fix: improve IndexedDB capability check.


##### 1.9.0 (2016-01-10)
- Feature: specify `range` option in Adapter.


##### 1.8.1 (2016-01-06)
- Fix: correctly use specified Promise implementation. Thanks [@mctep](https://github.com/mctep) for reporting!


##### 1.8.0 (2016-01-02)
- Feature: expose `transaction` on context object, so that input transform can make use of it.


##### 1.7.3 (2015-12-30)
- Fix: limit/offset fix in default adapters.
- Fix: error messaging in default serializer.
- Polish: improve ID check for transform function on an update request.


##### 1.7.1 (2015-12-30)
- Fix: zero limit in default adapters should work properly now.
- Feature: added `include` feature to default JSON serializer.


##### 1.7.0 (2015-12-30)
- Feature: accept different languages for internal messages.
- Feature: expose preferred language as `context.request.meta.language`.
- Feature: expose message function on Serializer and Adapter class.
- Moved headers to `context.request.meta.headers` and `context.response.meta.headers`.


##### 1.6.3 (2015-12-12)
- Fix: equality check for link fields in the memory adapter.


##### 1.6.2 (2015-12-11)
- Improve performance in IndexedDB adapter by stringifying everything.


##### 1.6.1 (2015-12-07)
- Fix: bugs in IndexedDB adapter.


##### 1.6.0 (2015-12-05)
- Performance: use Web Worker for IndexedDB adapter.
- Drop Web Storage adapter since its low quota makes it near useless.
- Drop WebSocket implementation since it is impossible to generalize.


##### 1.5.0 (2015-12-03)
- Feature: implemented user-defined type feature.
- Polish: removed `Symbol` as a valid type on record type definitions.


##### 1.4.24 (2015-12-02)
- Polish: avoid unnecessary cloning, may be breaking change but unlikely.
- Polish: add runtime check for the primary key on update objects.


##### 1.4.19 (2015-11-30)
- Polish: improve messaging in the documentation.
- Fix: IndexedDB and Web Storage adapter connect implementation.


##### 1.4.18 (2015-11-24)
- Fix: boolean matching in default JSON serializer.
- Polish: update dependencies, update readme.


##### 1.4.16 (2015-11-10)
- Fix: allow different object to be returned from `transformInput` on `create` method.


##### 1.4.15 (2015-11-08)
- Fix: Error when extending default serializer.
- Fix: don't swallow native input error.
- Feature: allow singular objects to be valid for creating and updating in the default serializer.


##### 1.4.12 (2015-11-07)
- Polish: add deprecation warning for `Fortune.create` method.


##### 1.4.11 (2015-11-06)
- Fix: try to fix ES6 class compatibility again.


##### 1.4.10 (2015-11-06)
- Polish: do not expose `transforms` object, keep it internal.


##### 1.4.9 (2015-11-06)
- Polish: drop `clone` module, use own implementation due to performance.
- Polish: expose `transforms` object to adapter and serializer, mostly used to check for existence.


##### 1.4.5 (2015-11-05)
- Polish: fix ES6 class compatibility for Adapter and Serializer.


##### 1.4.1 (2015-10-31)
- Polish: downgraded codebase from ES6 to ES5.1, performance improvements.


##### 1.3.15 (2015-10-23)
- Fix: use `parseFloat` for `Number` type. Thanks [@diogoazevedos](https://github.com/diogoazevedos)!


##### 1.3.14 (2015-10-21)
- Polish: display bad request error if related record is non-existent.


##### 1.3.13 (2015-10-05)
- Fix: HTTP content negotiation edge case when `Accept` media type is invalid.


##### 1.3.12 (2015-09-22)
- Polish: change event generation cleanup.


##### 1.3.11 (2015-09-18)
- Fix: prevent error on related update.


##### 1.3.10 (2015-09-14)
- Fix: avoid slicing on an undefined array field in update method.


##### 1.3.8 (2015-09-10)
- Fix: faulty check for invalid create/update payloads.


##### 1.3.7 (2015-09-10)
- Fix: check for invalid create/update payloads which have the same ID in multiple records for a to-one relationship.


##### 1.3.6 (2015-09-09)
- Polish: improve prototype checking in serializer and adapter.
- Polish: add more form handling logic.


##### 1.3.4 (2015-09-05)
- Polish: add JSON parsing error, disallow empty payload in default serializer for create and update.
- Fix: allow context to be mutated in `parseUpdate` and `parseCreate`.


##### 1.3.2 (2015-09-03)
- Fix: assign `inverse` field on denormalized inverse key. This allows for `inverse` field to be undefined.


##### 1.3.1 (2015-09-01)
- Polish: don't rely on `import *` so much, instead import exactly which exports are needed.
- Polish: rename `AdHocSerializer` to `JsonSerializer`, renamed key name from `adHoc` to `json`.
- Feature: support update from form serializer.
- Feature: support custom HTTP method override headers in ad hoc JSON serializer.


##### 1.3.0 (2015-09-01)
- Polish: all serializer methods may return a Promise.
- Feature: Form serializer now accepts `application/x-www-form-urlencoded` or `multipart/form-data`.


##### 1.2.5 (2015-08-29)
- Polish: drop `node-fetch` as a dependency for testing, instead use `http` module directly.


##### 1.2.4 (2015-08-29)
- Feature: add `enforceLinks` option, when set as `false` it will ignore referential integrity errors. Useful for client-side use.


##### 1.2.3 (2015-08-28)
- Polish: do not expose missing related records error, should be internal error.
- Polish: use UTF-8 charset for ad hoc serializer.
- Fix: match query in ad hoc serializer for array values.


##### 1.2.2 (2015-08-26)
- Fix: edge case in `processResponse` call not resolving to a promise.
- Polish: do not set response status code if it's already been set.


##### 1.2.0 (2015-08-25)
- Fix: cast array values in ad-hoc serializer.
- Polish: payload will always be a buffer when using `http` module.
- Feature: `x-www-form-urlencoded` serializer, used only for creating records.


##### 1.1.4 (2015-08-24)
- Fix: use `deep-equal` for object equality checking in the included adapters.


##### 1.1.3 (2015-08-24)
- Feature: support HTTP compression by default.


##### 1.1.2 (2015-08-20)
- Fix: sorting implementation in built-in adapters.
- Fix: matching implementation in built-in adapters.


##### 1.1.0 (2015-08-20)
- Feature: pass request meta-data to adapters. Thanks [@avens19](https://github.com/avens19)!
- Revert: do run `prepublish` on install.


##### 1.0.5 (2015-08-19)
- Improvement: do not run `prepublish` script on install.


##### 1.0.3 (2015-08-18)
- Minor bugfix: do not mutate update object in the request payload.


##### 1.0.2 (2015-08-17)
- Improvement: default priority of adapters in browser build: IndexedDB -> WebStorage -> memory adapter.


##### 1.0.1 (2015-08-17)
- Fix: improve error handling for edge cases, so that they are not swallowed.
- Polish: drop `babel-eslint`.


##### 1.0.0 (2015-08-15)
- Initial release of major version.


##### 1.0.0-rc.14 (2015-08-15)
- Implemented memory adapter, which replaces NeDB as the default adapter.
- Breaking change: removed NeDB adapter, now belongs to a separate module: `fortune-nedb`.
- Breaking change: browser build now defaults to memory adapter.


##### 1.0.0-rc.13 (2015-08-15)
- Breaking change: remove Micro API and JSON API serializers from this package, they are now external modules: `fortune-micro-api` and `fortune-json-api`.


##### 1.0.0-rc.12 (2015-08-15)
- Harden serializer error handling, now rendered errors will never leak native errors, but `catch` handler will always receive the actual error.
- Implemented ad-hoc JSON-over-HTTP serializer, intended to be the new included default serializer.


##### 1.0.0-rc.10 (2015-08-13)
- Allow `delete` method even if IDs are unspecified. A `delete` request with IDs unspecified will not return any records, but will emit a change event indicating the type deleted with a null value.


##### 1.0.0-rc.7 (2015-08-11)
- Fix: URI decoding bug when encoded characters are part of the path, not just the query. Thanks [@unindented](https://github.com/unindented) for reporting!


##### 1.0.0-rc.6 (2015-08-07)
- Prevent document replacement in NeDB adapter if no updates are specified.


##### 1.0.0-rc.4 (2015-08-06)
- Fix: `change` event for created record shows ID instead of `undefined`. Thanks [@unindented](https://github.com/unindented) for reporting!
- Polish: do not send `Content-Type` header for `204` responses.


##### 1.0.0-rc.3 (2015-08-03)
- Fix: when an update is modified in an input transform function, let the serializer know that the update has been modified and return the appropriate response.


##### 1.0.0-rc.2 (2015-08-03)
- Breaking change: `transformInput` may accept 3 arguments for an `update` method, the last argument being the update itself, mutating the record has no effect.
- Breaking change: all integrity checking is done after input transform.
- Fix: asynchronous input transform for `delete` method.


##### 1.0.0-rc.1 (2015-08-02)
- New website, vastly simplified design.
- Added error handling message about links in Micro API.


##### 1.0.0-beta.41 (2015-07-30)
- Fix URI encoding behavior in the serializers.
- Fix JSON API serializer to include nested include fields even if they were not specified.


##### 1.0.0-beta.40 (2015-07-27)
- Fix plural type in JSON API ad-hoc index.
- Fix key inflection in JSON API serializer.


##### 1.0.0-beta.39 (2015-07-27)
- Fix `null` values not being accepted for `Date` and `Buffer` types in the serializers.


##### 1.0.0-beta.38 (2015-07-26)
- Cast type of query string `match` in serializers.
- Fix handling of Date and Buffer types in serializers.
- Breaking change: simplified signature of WebSocket function.


##### 1.0.0-beta.34 (2015-07-24)
- Call WebSocket handler functions in the context of the socket.


##### 1.0.0-beta.33 (2015-07-24)
- Implement WebSocket network module.


##### 1.0.0-beta.32 (2015-07-24)
- Internal refactoring of tests.
- Fix camel cased key names not working properly in JSON API serializer for link fields.


##### 1.0.0-beta.31 (2015-07-22)
- Fix camel cased key names not working properly in JSON API serializer. Thanks [@dalefukami](https://github.com/dalefukami)!


##### 1.0.0-beta.30 (2015-07-22)
- Fix page limit option in JSON API serializer.
- Change implementation of limit in serializers so that arbitrary max limit cannot be specified.
- Rename options `pageLimit` to `maxLimit`, and `includeDepth` to `includeLimit`.


##### 1.0.0-beta.29 (2015-07-21)
- Expose abstract base classes in default export.
- Fix prototype checking in adapter and serializer.
- Prevent `include` from throwing an error.
- Improve include implementation.


##### 1.0.0-beta.25 (2015-07-21)
- Fixed `self` link and `data` type for related records in JSON API serializer.


##### 1.0.0-beta.24 (2015-07-19)
- Removed extraneous `id` field in Micro API serializer.
- Fixed sort implementation in serializers. Thanks [@nickschot](https://github.com/nickschot)!


##### 1.0.0-beta.23 (2015-07-15)
- Fixed JSON API serializer handling of plural types.
- Fixed JSON API serializer improperly deserializing reserved keywords.


##### 1.0.0-beta.21 (2015-07-14)
- Moved JSON stringification out of serializers.
- Added `options` optional parameter for `http` function.


##### 1.0.0-beta.20 (2015-07-13)
- Renamed `dispatch` to `request`. Internally the function is still `dispatch`, but the public API method name is changed, because it is more familiar terminology.
- Moved `methods` and `change` to static properties of top-level export.
- Drop arbitrary fields after running input transform.
- Map HTTP request headers to request `meta` object.


##### 1.0.0-beta.16 (2015-07-12)
- Update Micro API serializer to latest revision of spec. Now `@links` object is omitted per record, `@href` is removed, `@graph` is the container, and `@type` exists per record.
- The `adapter` and `serializer` singletons per Fortune instance are now non-enumerable.


##### 1.0.0-beta.14 (2015-07-08)
- Do not persist extraneous `id` field in NeDB adapter.
- Drop `@links` object in every response of Micro API serializer. Now only the top-level `@links` will be shown in the entry point.
- Fixed incorrect record type linking that passed checks.
- Fixed IndexedDB connection when a new type is added.


##### 1.0.0-beta.8 (2015-07-03)
- Implemented Web Storage adapter, which is used as a fallback when IndexedDB is not supported.
- Renamed keys of `adapters` and `serializers` static properties.


##### 1.0.0-beta.7 (2015-07-03)
- Major internal refactor, removed Dispatcher class.
- The `change` event is now emitted from the Fortune instance.


##### 1.0.0-beta.6 (2015-07-02)
- Fix error in browser build.
- Rename `start` to `connect`, and `stop` to `disconnect`. This matches the adapter method names.


##### 1.0.0-beta.4 (2015-07-02)
- Fix packaging of browser build, now it relies on the `browser` field.
- Update location of adapter test.
- Fix cross-browser compatibility issues with IndexedDB adapter.


##### 1.0.0-beta.1 (2015-06-29)
- Changed sort value from a number to a boolean.
- Moved body parsing to `Fortune.net.http`.
- Implemented IndexedDB adapter for browser build.


##### 1.0.0-alpha.12 (2015-06-19)
- Change how `inflectType` option works for JSON API serializer. Now it inflects types everywhere, not just the URI.
- Rename `inflectType` to `inflectPath` in the Micro API serializer to reflect this difference.
- Include a core build, acccessible as `import 'fortune/core'`. This compact build is targeted for web browsers.


##### 1.0.0-alpha.10 (2015-06-15)
- Throw a BadRequestError by default if input is wrong.
- Do not rely on `[Symbol] in ...`, it's incorrect implementation in ES6.
- The http module resolves to `context.response` on success.


##### 1.0.0-alpha.9 (2015-06-05)
- Disallow related record creation route for Micro API. The complexity is not worth it.
- Make default `Allow` header response configurable.


##### 1.0.0-alpha.8 (2015-06-04)
- Internal refactor: `Serializer` base class no longer implements anything, implementation moved to `DefaultSerializer` class.
- Fix link ID enforcement, add tests.
- Fix `Content-Length` header value for unicode string payloads.
- Restrict deleting and patching a collection for JSON API, restrict creating with ID in route for Micro API.
- Show `Allow` header when method is unsupported or `OPTIONS` request is sent.
- For JSON API and Micro API, serializer input must match the output.


##### 1.0.0-alpha.7 (2015-06-03)
- Renamed `schemas` -> `recordTypes`, and `schema` -> `field`. "Schema" was incorrect terminology to use in the first place, record type is much more restrictive.


##### 1.0.0-alpha.6 (2015-06-02)
- Added adapter test for duplicate ID creation: it must fail and throw a `ConflictError`.
- Added adapter tests for checking `Buffer` and `Date` types.
- JSON API serializer enforces media type according to the spec.


##### 1.0.0-alpha.5 (2015-06-01)
- Denormalized fields should not be enumerable in returned records from the adapter.


##### 1.0.0-alpha.4 (2015-05-31)
- Micro API serializer now obfuscates URIs by default.
- Test runner no longer relies on environment variable.
- Add test for primary key type returned from the adapter.


##### 1.0.0-alpha.1 (2015-05-30)
- Complete rewrite, the only similarities it has with previous versions is in spirit.
- The changelog has been abbreviated to only include changes starting from this version.
