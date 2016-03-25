'use strict'

var fs = require('fs')
var path = require('path')

var map = require('../common/array/map')
var filter = require('../common/array/filter')

var stylesheet = [
  '<style>',
  fs.readFileSync(path.join(__dirname, 'page.css'))
    .toString().replace(/(\r\n|\n|\r)/gm, ''),
  '</style>'
].join('')

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

var fragments = {
  docType: '<!DOCTYPE html>',
  viewport: '<meta name="viewport" ' +
    'content="width=device-width,initial-scale=1">'
}


module.exports = function (HttpSerializer) {
  /**
   * This is an ad hoc HTML serializer, which is suitable for humans.
   */
  function HtmlSerializer (properties) {
    HttpSerializer.call(this, properties)
  }

  HtmlSerializer.prototype = Object.create(HttpSerializer.prototype)


  HtmlSerializer.prototype.processResponse =
  function (contextResponse, request, response) {
    var prefix = this.options.prefix || ''
    var uriBase64 = this.options.uriBase64
    // var bufferEncoding = this.options.bufferEncoding || 'base64'
    var payload = contextResponse.payload
    var meta = contextResponse.meta || {}
    var method = request.meta.method
    var language = request.meta.language
    var updateModified = meta.updateModified
    var methods = this.methods
    var message = this.message
    var keys = this.keys
    var primaryKey = keys.primary
    var isArrayKey = keys.isArray
    var typeKey = keys.type
    var linkKey = keys.link
    var recordTypes = this.recordTypes
    var encodeRoute = this.encodeRoute
    var page = [ fragments.docType, fragments.viewport, stylesheet ]
    var type = request.meta.originalType || request.meta.type
    var ids = request.meta.originalIds || request.meta.ids
    var relatedField = request.meta.relatedField
    var key, parts, breadcrumbs, groups

    // Delete and update requests may not respond with anything.
    if (method === methods.delete ||
      (method === methods.update && !updateModified)) {
      // TODO: redirect
      delete contextResponse.payload
      return contextResponse
    }

    // Set the charset to UTF-8.
    response.setHeader('Content-Type',
      HtmlSerializer.mediaType + '; charset=utf-8')

    if (payload != null) {
      parts = []
      groups = []

      if (type) parts.push(escapeHtml(type))
      if (ids) parts.push(escapeHtml(ids.join(', ')))
      if (relatedField) parts.push(escapeHtml(relatedField))
      page.push(tag('title', parts.join(' &rarr; ')))

      breadcrumbs = [
        tag('a', { href: prefix + '/' }, message('Index', language))
      ].concat(map(parts, function (text, index) {
        return tag('a', {
          href: prefix + (
            index === 0 ? encodeRoute(type, null, null, uriBase64) :
            index === 1 ? encodeRoute(type, ids, null, uriBase64) :
            index === 2 ? encodeRoute(type, ids, relatedField, uriBase64) :
            'error'),
          'class': index === 0 ? 'type' : ''
        }, text)
      })).join(' &rarr; ')

      groups.push(renderGroup(request.meta.type,
        contextResponse.payload.records))

      page.push(tag('main', [
        tag('header', [
          breadcrumbs
        ]),
        groups.join('')
      ]))
    }

    else if (contextResponse instanceof Error)
      // If the error is type unspecified, show the index.
      if (contextResponse.isTypeUnspecified) {
        page.push(tag('title', message('Index', language)))
        page.push(tag('div', { 'class': 'index' },
          tag('div', { 'class': 'index-cell' }, [
            tag('h4', tag('span', message('Type', language))),
            tag('ul', (function () {
              var items = []

              for (key in recordTypes)
                items.push(tag('li', tag('a', {
                  href: prefix + encodeRoute(key, null, null, uriBase64)
                }, escapeHtml(key))))

              return items.join('')
            }()))
          ])))

        response.statusCode = 200
      }

      else {
        page.push(tag('title', contextResponse.toString()))
        page.push(tag('div', { 'class': 'index' },
          tag('div', { 'class': 'index-cell' }, [
            tag('h1', contextResponse.name),
            tag('p', contextResponse.message)
          ])))
      }

    contextResponse.payload = page.join('')

    return contextResponse

    function renderGroup (type, records, included) {
      var empty = tag('span', { 'class': 'empty' },
        message('Empty', language))
      var heading, keys, columns

      heading = [
        tag('span', { 'class': 'type' }, type),
        records.count && records.count > records.length ?
          tag('span', '(' + records.count + ')') : '',
        included ? tag('span',
          '(' + message('IncludedLabel', language) + ')') : ''
      ].join(' ')

      keys = Object.keys(recordTypes[type])

      if ('fields' in request.meta.options)
        keys = filter(keys, function (key) {
          return key in request.meta.options.fields
        })

      columns = [ primaryKey ].concat(keys.sort())

      return tag('div', { 'class': 'group' }, [
        tag('h4', heading),
        tag('div', { 'class': 'box' }, [
          tag('div', { 'class': 'row' }, columns.map(function (key) {
            return tag('div', { 'class': 'column' }, escapeHtml(key))
          }))
        ].concat(records.length ? map(records, function (record) {
          return tag('div', { 'class': 'row' }, columns.map(function (key) {
            var fieldType = key in recordTypes[type] &&
              recordTypes[type][key][typeKey]
            var fieldIsArray = key in recordTypes[type] &&
              recordTypes[type][key][isArrayKey]
            var fieldLink = key in recordTypes[type] &&
              recordTypes[type][key][linkKey]
            var value, display

            value = fieldIsArray ? record[key] : [ record[key] ]

            if (!value.length) value = empty
            else value = map(value, function (x) {
              if (x === null || x === void 0) return empty

              if (fieldType === Buffer) x = x.toString('base64')
              else if (fieldType === Date) x = x.toJSON()
              else if (fieldType === Object || fieldType === Array)
                x = JSON.stringify(x)
              else x = escapeHtml(x.toString())

              return tag('span', { 'class': 'value' }, x)
            }).join(', ')

            return tag('div', { 'class': 'column' },
              key === primaryKey || fieldLink ? tag('a', {
                href: encodeRoute(type, [ record[primaryKey] ],
                  key !== primaryKey && key, uriBase64)
              }, value) : value)
          }))
        }) : tag('div', { 'class': 'row empty' },
          message('NoResults', language))))
      ])
    }
  }


  HtmlSerializer.prototype.parsePayload = function (contextRequest) {
    var method = contextRequest.method
    var language = contextRequest.meta.language
    var message = this.message
    var MethodError = this.errors.MethodError

    throw new MethodError(message(
      'InvalidMethod', language, { method: method }))
  }

  HtmlSerializer.mediaType = 'text/html'

  return HtmlSerializer
}


function escapeHtml (str) {
  return str.replace(/[&<>"'`=\/]/g, function (x) { return entityMap[x] })
}


function tag (name, attr, content) {
  var attributes = '', key

  if (typeof attr === 'object' && !Array.isArray(attr)) {
    attributes = []
    for (key in attr) attributes.push(key + '="' + attr[key] + '"')
    attributes = ' ' + attributes.join(' ')
  }
  else content = attr

  if (typeof content === 'function') content = content()

  return '<' + name + attributes + '>' +
    (Array.isArray(content) ? content.join('') : content) +
    '</' + name + '>'
}
