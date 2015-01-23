# To-do list

- Server initialization method.
- Add serializer hooks to allow the entire request/response payload to be transformed (useful for "meta" object).
- Pagination.

### Done

- Ordered serializers by priority.
- Typed errors.
- Remove the `_relatedType` and `_relatedIds`.
- Router abstraction from HTTP, consolidate `request` and `response` in the `context` object.
- Remove `require` calls in Serializer and Adapter. Resolved by removing strings.
