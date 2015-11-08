'use strict'

var clone = require('../common/clone')
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
  var BadRequestError = this.errors.BadRequestError
  var type = context.request.type
  var hasTransform = this.transforms[type] && this.transforms[type].input
  var ids = context.request.ids
  var payload = context.request.payload

  if (ids) throw new BadRequestError('IDs should not be specified.')
  if (!payload) throw new BadRequestError('Payload is missing.')

  if (!Array.isArray(payload)) payload = [ payload ]

  return hasTransform ? clone(payload) : payload
}


module.exports = DefaultSerializer
