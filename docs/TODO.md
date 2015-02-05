# To-do list

- Consider using [URI Template](http://tools.ietf.org/html/rfc6570).
- Router should do all adapter calls to sync inverse relationships.
- Write tests with tape.

## Done

- Remove 6to5 from distribution.
- Pagination (limit and offset options in the adapter).
- Add serializer hooks to allow the entire request/response payload to be transformed (useful for "meta" object). Implemented as `Serializer.processRequest`.
- Reorganize file/folder structure.
- Server initialization method? This is now handled separately from Core module.
- Should serializer process query strings? Leaning towards no since that is HTTP, but maybe? Actually I think it should though. Now it is implemented as `Serializer.processRequest`.
- Request options should be specific to a type.
- Make router call stubs to adapter for ACID transactions.
- Option to disable casting and mangling of buffers? Now this option exists.
- Removed `inflect` and `prefix` options, these should be handled per serializer and by routers.
- Make serializer methods return context, this makes life easier.
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
