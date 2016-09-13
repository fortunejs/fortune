# Concepts

Fortune.js is a library that provides a common interface for disparate kinds of databases to be able to run anywhere, through any network protocol or none at all. What it actually abstracts is a sort of [graph database](https://en.wikipedia.org/wiki/Graph_database) that makes a few assumptions up front.


## Records and Record Types

A [record](https://en.wikipedia.org/wiki/Struct) in Fortune.js is a plain JavaScript object with a restriction: it must follow the definition of a record type. A record type is a set of user-defined fields which must be strongly typed, like a `struct` in C. This means that records are data, and do not contain methods beyond the standard Object prototype. This is done intentionally to avoid the [quagmire of object-relational mapping, or ORM](https://blog.codinghorror.com/object-relational-mapping-is-the-vietnam-of-computer-science/).

Fortune.js implements type validations for built-in JavaScript types and Buffers. Custom types may be defined on top of the built-in types, that provide additional guarantees. Strict typing is necessary in relational databases, but real world applications using non-relational databases typically follow an ad hoc schema. Fortune.js makes it so that strict typing is required.


## Graph Database

Fortune.js emulates the functionality of a graph database by directly storing relationships between records. Each record may contain IDs that link to other records, and each record that is linked to contains an ID that links back. When a record is written with links, Fortune.js automatically writes inverse links. This means that relationships are always denormalized, existing in exactly two places: the records which contain the forward and backward directions of a relationship.

Fortune.js implements a primitive in-memory database, and can be adapted to other storage options. How it maps to document databases is fairly straightforward, but how it maps to relational databases is not idiomatic. Instead of join tables, it uses array columns for storing IDs. As of writing, there are no major relational databases which support array foreign keys, so referential integrity is handled entirely at the application level.


## Adapters

An adapter is an object that inherits from the `fortune.Adapter` abstract base class and must implement some required methods. Adapters must support a common subset of functionality that is generally available across most databases, basically [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) with some querying. The adapter translates the data from the request method into database operations. Since adapters must only perform a baseline of operations, adapters [may not implement everything that a database can do](https://en.wikipedia.org/wiki/Database_abstraction_layer#Masked_operations), so in specific use cases, calling the database directly may be needed.


## Driven by Data and Events

The `fortune.request` method of a Fortune.js instance takes a serializable object as its only argument. This argument is useful for not only internal API calls, but also network requests. The included network implementations for HTTP and WebSocket translate to and from external requests and responses, which decouples application code from a single network protocol, or none at all.

Any request method which changes records, such as create, update, and delete, will emit `change` events on the Fortune.js instance. This event contains a summary of all that was changed in a single request, and is useful for soft real-time updates. The `fortune.net.sync` convenience method uses the data emitted from this event.
