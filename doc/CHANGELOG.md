# Changelog


##### 1.0.0-beta.12 (2015-07-07)
- Fixed incorrect record type linking that passed checks.


##### 1.0.0-beta.11 (2015-07-06)
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


##### 1.0.0-beta.2 (2015-06-30)
- Fix cross-browser compatibility issues with IndexedDB adapter.


##### 1.0.0-beta.1 (2015-06-29)
- Changed sort value from a number to a boolean.
- Moved body parsing to `Fortune.net.http`.
- Implemented IndexedDB adapter for browser build.


##### 1.0.0-alpha.12 (2015-06-19)
- Change how `inflectType` option works for JSON API serializer. Now it inflects types everywhere, not just the URI.
- Rename `inflectType` to `inflectPath` in the Micro API serializer to reflect this difference.


##### 1.0.0-alpha.11 (2015-06-18)
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
