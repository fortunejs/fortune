# Codebase

Written in ECMAScript 5.1.


## Adapter

The Adapter class is an [abstract base class](https://en.wikipedia.org/wiki/Class_%28computer_programming%29#Abstract_and_concrete). does not provide ORM-like capabilities, it is just a means to get records into and out of a data store. The objects it deals with are just plain objects with no methods attached, so it does not follow the active record pattern.

There is an important requirement for a primary key per record, which Fortune relies on and is a **MUST** to implement. Every record returned by the adapter must have a primary key, which by default is `id`. The primary key must be a string or a number.


## Serializer

The Serializer class is an [abstract base class](https://en.wikipedia.org/wiki/Class_%28computer_programming%29#Abstract_and_concrete). Serializers process and render external input and output.

There are two (optionally) asynchronous methods, `processRequest` and `processResponse` which take arbitrary arguments, which can be used to mutate the context.


## Dispatch

The purpose of the `dispatch` function is to dynamically dispatch internal functions that mutate the state of a `context` object based on the request.

The middleware functions mutate the `context` object until the end of the request is reached, and returns the `response` key of the `context`.


## Record Type

Internal implementations for validating and enforcing the record type definition that is expected by adapters and serializers.


## Net

External networking wrappers, provided for convenience and as reference implementations. Completely optional.
