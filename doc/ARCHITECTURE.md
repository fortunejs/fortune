# Architecture

This document explains the inner workings of Fortune.


## Adapter

The adapter does not provide ORM-like capabilities, it is just a means to get objects into and out of a data store. The objects it deals with are just plain objects with no methods attached.

There is an important global concept of primary key, which Fortune relies on and is a **MUST** to implement. Every object returned by the adapter must have a primary key, which by default is `id` but can be configured to any arbitrary name. The primary key may be arbitrarily defined as long as it is not null and unique. Serializers may transform this primary key to clients, so the primary key configuration may not necessarily reflect what a client sees.


## Serializer

Serializers parse and render external input and output. The input parsing methods accept the `context` and should return arrays of objects, while the output rendering methods accept arrays of objects and should mutate the `context`. The schema is enforced before parsing and after rendering, so that types from input to output will be consistent.

There are two special methods, `processRequest` and `processResponse` which take arbitrary arguments, which can be used to mutate the context. `processRequest` may be used to transform a request generated from HTTP into the internal format.


## Dispatcher

The goal of the dispatcher is to dynamically dispatch functions based on the input. The dispatcher is concerned with the sequence of that flow from the client through to the data adapter, and back to the client again, or from the dispatcher to the client via the `change` event.

It passes data to the next handler in a request lifecycle, using the `context` object through its internal methods. The internal methods mutate the `context` until the end of the request is reached, and returns the `response` part of the `context`.

Schema enforcement happens here, types are casted before `before` transforms and after `after` transforms, so that types should be consistent with the schema.
