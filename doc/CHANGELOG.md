# Changelog


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
