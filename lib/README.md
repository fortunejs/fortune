# Codebase

Object orientation [sucks](https://www.sics.se/~joe/bluetail/vol1/v1_oo.html), classes [suck](http://ericleads.com/2012/09/stop-using-constructor-functions-in-javascript/), using `new` [sucks](http://www.ianbicking.org/blog/2013/04/new-considered-harmful.html), Promises [suck](http://robotlolita.me/2013/06/28/promises-considered-harmful.html). Everything sucks, so deal with it.


## Adapter

The adapter does not provide ORM-like capabilities, it is just a means to get records into and out of a data store. The objects it deals with are just plain objects with no methods attached.

There is an important global concept of primary key, which Fortune relies on and is a **MUST** to implement. Every object returned by the adapter must have a primary key, which by default is `id`. The primary key may be arbitrarily defined as long as it is not null and unique.


## Serializer

Serializers process and render external input and output.

There are two (optionally) asynchronous methods, `processRequest` and `processResponse` which take arbitrary arguments, which can be used to mutate the context.


## Dispatcher

The goal of the dispatcher is to dynamically dispatch functions that mutate state based on the request.

It runs a series of middleware functions that mutate state, the `context` object, until the end of the request is reached, and returns the `response` key of the `context`.

The dispatcher subclasses `EventEmitter` and emits a `change` event whenever a request that modifies records is completed.


## Schema

Internal implementation for validating and enforcing the schema that is expected by adapters, serializers, and the dispatcher.


## Net

Currently there is only a basic HTTP `requestListener`. There may be a WebSocket implementation for the dispatcher in the future.
