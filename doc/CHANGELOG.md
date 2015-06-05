# Changelog


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
