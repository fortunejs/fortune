'use strict'

var Fortune = require('../core')
var keys = require('../common/keys')
var methods = require('../common/methods')
var errors = require('../common/errors')
var castValue = require('../common/cast_value')
var castToNumber = require('../common/cast_to_number')
var promise = require('../common/promise')
var message = require('../common/message')

var HttpSerializer = require('./http_serializer')
var initializeContext = require('./http_initialize_context')
var encodeRoute = require('./http_encode_route')


module.exports = instantiateSerializer


function instantiateSerializer (instance, serializer, options) {
  var Promise = promise.Promise
  var CustomSerializer, mediaType

  if (!(instance instanceof Fortune))
    throw new TypeError('An instance of Fortune is required.')

  if (typeof serializer !== 'function')
    throw new TypeError('The HTTP serializer must be a function.')

  if (options === void 0) options = {}

  CustomSerializer = HttpSerializer.prototype
    .isPrototypeOf(serializer.prototype) ?
      serializer : serializer(HttpSerializer)

  if (!HttpSerializer.prototype.isPrototypeOf(CustomSerializer.prototype))
    throw new TypeError('The serializer must inherit the HttpSerializer ' +
      'class.')

  mediaType = CustomSerializer.mediaType

  if (typeof mediaType !== 'string')
    throw new TypeError('A media type must be defined as a string for the ' +
      'HttpSerializer.')

  return new CustomSerializer({
    methods: methods,
    errors: errors,
    keys: keys,
    recordTypes: instance.recordTypes,
    castValue: castValue,
    castToNumber: castToNumber,
    initializeContext: initializeContext,
    encodeRoute: encodeRoute,
    options: options,
    mediaType: mediaType,

    // This is the settings defined in the Fortune instance, not the HTTP
    // specific settings.
    settings: instance.options.settings,
    documentation: instance.options.documentation,

    adapter: instance.adapter,
    message: message,
    Promise: Promise
  })
}
