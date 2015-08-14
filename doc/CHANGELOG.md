# Changelog


##### 1.0.0-rc.11 (2015-08-15)
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
