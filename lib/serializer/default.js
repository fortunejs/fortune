'use strict'

var Serializer = require('./')


/**
 * Default serializer implementation. It doesn't have an ID, because it doesn't
 * need one.
 */
function DefaultSerializer (properties) {
  Serializer.call(this, properties)
}


DefaultSerializer.prototype = Object.create(Serializer.prototype)


DefaultSerializer.prototype.showResponse =
  function (context, records, include) {
    var response = context.response

    if (!records) {
      response.payload = Object.keys(this.recordTypes)
      return context
    }

    if (include) records.include = include
    response.payload = records

    return context
  }


DefaultSerializer.prototype.showError = function (context, error) {
  var response = context.response
  var name = error.name
  var message = error.message

  response.payload = { name: name }
  if (message) response.payload.message = message

  return context
}


DefaultSerializer.prototype.parseCreate = parse
DefaultSerializer.prototype.parseUpdate = parse


function parse (context) {
  var message = this.message
  var BadRequestError = this.errors.BadRequestError
  var ids = context.request.ids
  var payload = context.request.payload
  var language = (context.request.meta || {}).language

  if (ids) throw new BadRequestError(message('SpecifiedIDs', language))
  if (!payload) throw new BadRequestError(message('MissingPayload', language))

  if (!Array.isArray(payload)) payload = [ payload ]

  return payload
}


module.exports = DefaultSerializer
