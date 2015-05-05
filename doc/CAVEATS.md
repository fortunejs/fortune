# Caveats

Using Fortune comes with some tradeoffs that arise from intentional limitations of the adapter.


## Undirected Graph

Fortune enforces an undirected graph of relationships, for a few reasons:

- An undirected graph makes it impossible to reach an orphan node without *a priori* knowledge. See [deep hypertext in Xanadu](http://xanadu.com/xuTheModel/) for the concept behind this.
- Showing relationships is more performant since there is no querying to be done (the data is denormalized), but writing relationships is slower depending on the amount of related records.
- Undirected graphs are simpler to implement and easier to understand.

This is a tradeoff that sacrifices flexibility and denormalizes relationships in favor of visibility. The design also eliminates guarantees of consistency in databases that do not support transactions.


## Key-Value Storage

There is no built-in support for deeply nested objects, it treats an object as a singular value. Any comprehension of data types beyond the built-ins is specific to the adapter.
