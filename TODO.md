# To-do list

- Should serializer process query strings? Leaning towards no since that is HTTP, but maybe? Actually I think it should though.
- Write tests with tape.
- Server initialization method.
- Add serializer hooks to allow the entire request/response payload to be transformed (useful for "meta" object).
- Pagination.

### Done

- Create linked entity if there was a related field.
- Include uniqueness problem if original request does not supply IDs.
- Primary key configuration.
- Minimize or eliminate `indexOf`, `map`, `reduce` calls.
- ID requirement? Primary key? Problem with checking object sameness for includes by ID. Resolved with ID lookup hash table.
- Schema enforcement during I/O.
- Ordered serializers by priority.
- Typed errors.
- Remove the `_relatedType` and `_relatedIds`.
- Router abstraction from HTTP, consolidate `request` and `response` in the `context` object.
- Remove `require` calls in Serializer and Adapter. Resolved by removing strings.
