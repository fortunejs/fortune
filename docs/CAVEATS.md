# Caveats

Using Fortune comes with some tradeoffs that arise from intentional design decisions.


### What It Is Not

Fortune is not a framework, it is intended to be composed within Node web frameworks or used as a standalone library. There are not features that web frameworks typically provide, such as application structure, active records, route matching (this may optionally be handled by the serializer), etc.


### Undirected Graph

Fortune denormalizes all relationships by their inverse fields. If you do not specify an inverse field for a link explicitly, Fortune will automatically create one that is named like `__${type}_${field}_inverse` (this field should never be exposed). There are a few reasons:

- An undirected graph makes it impossible to reach an orphan node without *a priori* knowledge. See [deep hypertext in Xanadu](http://xanadu.com/xuTheModel/) for the concept behind this.
- Showing relationships is more performant since there is less querying to be done (the data is denormalized), but writing relationships is slower depending on the amount of related records.
- Key-value stores do not facilitate querying fields within values.

This is a tradeoff that sacrifices data normalization. The design also eliminates guarantees of consistency in databases that do not support transactions.


### Polymorphic Associations

This is not supported and there are no plans to support it. Just create multiple foreign keys to support linking to different types.


### Key-Value Storage

There is no built-in support for deeply nested objects, it treats an object as a singular value. Any comprehension of data types beyond the built-in types is specific to the adapter.
