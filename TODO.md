# To-do list

- ID requirement? Primary key? Problem with checking object sameness for includes by ID.
- Write tests with tape.
- Server initialization method.
- Add serializer hooks to allow the entire request/response payload to be transformed (useful for "meta" object).
- Pagination.

### Done

- Schema enforcement during I/O.
- Ordered serializers by priority.
- Typed errors.
- Remove the `_relatedType` and `_relatedIds`.
- Router abstraction from HTTP, consolidate `request` and `response` in the `context` object.
- Remove `require` calls in Serializer and Adapter. Resolved by removing strings.
