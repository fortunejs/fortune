'use strict'

var urlLib = require('url')
var parseUrl = urlLib.parse

var castToNumber = require('../common/cast_to_number')
var message = require('../common/message')
var methods = require('../common/methods')
var assign = require('../common/assign')
var castValue = require('../common/cast_value')
var map = require('../common/array/map')
var filter = require('../common/array/filter')
var reduce = require('../common/array/reduce')

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError

var keys = require('../common/keys')
var typeKey = keys.type
var linkKey = keys.link
var denormalizedInverseKey = keys.denormalizedInverse

var isMatch = /^match\./
var isRange = /^range\./
var isExists = /^exists\./

var buffer = Buffer.from || Buffer

var methodMap = {
  'GET': methods.find,
  'POST': methods.create,
  'PATCH': methods.update,
  'DELETE': methods.delete
}

var allowLevel = [
  [ 'GET' ], // Index
  [ 'GET', 'POST', 'PATCH', 'DELETE' ], // Collection
  [ 'GET', 'PATCH', 'DELETE' ], // Records
  [ 'GET', 'PATCH', 'DELETE' ] // Related records
]

var entityMap = {
  '-': '+',
  '_': '/'
}

// Cache parsed prefix paths.
var prefixPath = {}


function initializeContext (contextRequest, request, response) {
  var recordTypes = this.recordTypes
  var adapter = this.adapter
  var meta = contextRequest.meta
  var options = this.options
  var uriBase64 = options.uriBase64
  var castId = options.castId
  var prefix = options.prefix
  var url = request.url
  var type, ids, method, fields, relatedField, language, parsedUrl, parts,
    route, query, findOptions, output, i, j

  request.meta = {}

  language = request.meta.language = meta.language

  // Set the request method.
  method = request.meta.method = contextRequest.method =
    methodMap[request.method]

  // Decode URIs.
  if (uriBase64) {
    // The query string should not be encoded.
    route = url.slice(1).split('?')
    query = '?' + route.slice(1).join('?')

    url = '/' + buffer((route[0] + Array(5 - route[0].length % 4)
      .join('=')).replace(/[\-_]/g, function (x) { return entityMap[x] }),
      'base64').toString() + query
  }

  parsedUrl = contextRequest.parsedUrl = parseUrl(url, true)

  // If a prefix is specified, it is necessary to remove it from the path
  // before processing it.
  if (prefix) {
    if (!prefixPath.hasOwnProperty(prefix))
      prefixPath[prefix] = parseUrl(prefix).pathname

    prefix = prefixPath[prefix]

    if (parsedUrl.pathname.indexOf(prefix) === 0)
      parsedUrl.pathname = parsedUrl.pathname.substr(prefix.length)
  }

  parts = parsedUrl.pathname.split('/')

  // Strip empty string before slash prefix.
  parts.shift()

  // Strip trailing slash.
  if (parts[parts.length - 1] === '') parts.pop()

  for (i = 0, j = parts.length; i < j; i++)
    parts[i] = decodeURIComponent(parts[i])

  if (parts.length > 3)
    throw new NotFoundError(message('InvalidURL', language))

  if (parts[0]) {
    type = request.meta.type = contextRequest.type = parsedUrl.type =
      parts[0]

    if (!recordTypes.hasOwnProperty(type))
      throw new NotFoundError(message('InvalidType', language, { type: type }))

    fields = recordTypes[type]
  }
  else parts.shift()

  // Respond to options request, or otherwise invalid method.
  if (!method && (!type || recordTypes.hasOwnProperty(type))) {
    response.statusCode = 204
    output = new Error()

    output.isMethodInvalid = true
    output.meta = {
      headers: {
        'Allow': allowLevel[parts.length].join(', ')
      }
    }

    throw output
  }

  if (parts[1]) {
    ids = request.meta.ids = contextRequest.ids = parsedUrl.ids =
      parts[1].split(',')

    if (castId)
      ids = request.meta.ids = contextRequest.ids = map(ids, castToNumber)
  }

  if (parts[2])
    relatedField = contextRequest.relatedField = request.meta.relatedField =
      parsedUrl.relatedField = parts[2]

  attachQueries.call(this, contextRequest, parsedUrl.query)

  request.meta.include = contextRequest.include
  request.meta.options = contextRequest.options

  if (relatedField) {
    if (!fields.hasOwnProperty(relatedField) ||
      !(linkKey in fields[relatedField]) ||
      fields[relatedField][denormalizedInverseKey])
      throw new NotFoundError(message('InvalidURL', language))

    // Only care about getting the related field.
    findOptions = { fields: {} }
    findOptions.fields[relatedField] = true

    return adapter.find(type, ids, findOptions, meta)

    .then(function (records) {
      // Reduce the related IDs from all of the records into an array of
      // unique IDs.
      var relatedIds = []
      var seen = {}
      var value, relatedType
      var i, j, k, l

      for (i = 0, j = records.length; i < j; i++) {
        value = records[i][relatedField]

        if (!Array.isArray(value)) value = [ value ]

        for (k = 0, l = value.length; k < l; k++)
          if (!seen.hasOwnProperty(value[k])) {
            seen[value[k]] = true
            relatedIds.push(value[k])
          }
      }

      relatedType = fields[relatedField][linkKey]

      // Copy the original type and IDs to other keys.
      contextRequest.originalType = request.meta.originalType = type
      contextRequest.originalIds = request.meta.originalIds = ids

      // Write the related info to the request, which should take
      // precedence over the original type and IDs.
      contextRequest.type = request.meta.type = relatedType
      contextRequest.ids = request.meta.ids = relatedIds

      return contextRequest
    })
  }

  return contextRequest
}


function attachQueries (contextRequest, query) {
  var recordTypes = this.recordTypes
  var includeLimit = this.options.includeLimit || 5
  var maxLimit = this.options.maxLimit || 1000
  var options = contextRequest.options = {}
  var type = contextRequest.type
  var fields = recordTypes[type]
  var opts = { language: contextRequest.meta.language }
  var parameter, field, fieldType, value, limit

  // Attach fields option.
  if ('fields' in query) {
    options.fields = reduce(
      Array.isArray(query.fields) ? query.fields : [ query.fields ],
      function (fields, field) {
        fields[field] = true
        return fields
      }, {})

    // Remove empty queries.
    delete options.fields['']
    if (!Object.keys(options.fields).length) delete options.fields
  }

  // Iterate over dynamic query strings.
  for (parameter in query) {
    field = parameter.split('.')[1]

    // Attach match option.
    if (parameter.match(isMatch)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.match) options.match = {}
      fieldType = fields[field][typeKey]

      options.match[field] = Array.isArray(value) ? map(value,
        curryCast(castValue, fieldType, assign(opts, options))) :
        castValue(value, fieldType, assign(opts, options))

      continue
    }

    // Attach range option.
    if (parameter.match(isRange)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.range) options.range = {}
      fieldType = fields[field][typeKey]

      if (!Array.isArray(value)) value = [ value ]

      options.range[field] = map(value,
        curryCast(castValue, fieldType, assign(opts, this.options)))

      continue
    }

    // Attach exists option.
    if (parameter.match(isExists)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.exists) options.exists = {}
      if (value === '0' || value === 'false')
        options.exists[field] = false
      if (value === '1' || value === 'true')
        options.exists[field] = true
    }
  }

  // Attach sort option.
  if ('sort' in query) {
    options.sort = reduce(
      Array.isArray(query.sort) ? query.sort : [ query.sort ],
      function (sort, field) {
        if (field.charAt(0) === '-') sort[field.slice(1)] = false
        else sort[field] = true
        return sort
      }, {})

    // Remove empty queries.
    delete options.sort['']
    if (!Object.keys(options.sort).length) delete options.sort
  }

  // Attach include option.
  if ('include' in query)
    contextRequest.include = map(
      filter(Array.isArray(query.include) ? query.include : [ query.include ],
        function (x) { return x }),
      function (x) {
        var parts = x.split(',')
        var path = parts[0].split('.')

        path.splice(includeLimit)
        if (parts[1]) path.push(JSON.parse(parts[1]))

        return path
      })

  // Attach offset option.
  if ('offset' in query)
    options.offset = Math.abs(parseInt(query.offset, 10))

  // Attach limit option.
  if ('limit' in query)
    options.limit = Math.abs(parseInt(query.limit, 10))

  // Check limit option.
  limit = options.limit
  if (!limit || limit > maxLimit) options.limit = maxLimit
}


function curryCast (fn, type, options) {
  return function (value) {
    return fn(value, type, options)
  }
}


// Expose internal query attachment function.
initializeContext.attachQueries = attachQueries

module.exports = initializeContext
