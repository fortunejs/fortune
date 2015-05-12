# Caveats

Using Fortune comes with some tradeoffs that arise from intentional design decisions.


### What It Is Not

- Fortune is not a framework, it is intended to be composed within Node web frameworks or used standalone.
- There is no MVC, no active record pattern, and no routing (this may optionally be handled by the serializer).
- Record types are only concerned with field types and foreign keys, there is no other built-in validation.


### Undirected Graph

Fortune denormalizes all relationships to look more like an undirected graph of relationships. If you do not specify an inverse field for a link explicitly, Fortune will automatically create one that is named like `__$(type)_$(field)_inverse` (this field should never be exposed). There are a few reasons:

- An undirected graph makes it impossible to reach an orphan node without *a priori* knowledge. See [deep hypertext in Xanadu](http://xanadu.com/xuTheModel/) for the concept behind this.
- Showing relationships is more performant since there is less querying to be done (the data is denormalized), but writing relationships is slower depending on the amount of related records.
- Undirected graphs are simpler to implement and easier to understand.

This is a tradeoff that sacrifices flexibility in favor of visibility. The design also eliminates guarantees of consistency in databases that do not support transactions.


### Key-Value Storage

There is no built-in support for deeply nested objects, it treats an object as a singular value. Any comprehension of data types beyond the built-ins is specific to the adapter.
