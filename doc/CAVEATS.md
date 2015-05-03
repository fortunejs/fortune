# Caveats

Fortune enforces an undirected graph of relationships, for a few reasons:

- An undirected graph makes it impossible to reach an orphan node without *a priori* knowledge. See [deep hypertext in Xanadu](http://xanadu.com/xuTheModel/) for the concept behind this.
- Showing relationships is more performant since there is no querying to be done, but writing relationships is slower depending on the amount of related records.
- Undirected graphs are simpler to implement and easier to understand.

This is a tradeoff that sacrifices flexibility and complicates [referential integrity](https://en.wikipedia.org/wiki/Referential_integrity) in favor of visibility. The design also eliminates any guarantees of referential integrity in databases that do not support transactions. It could be modified to support directed graphs however.
