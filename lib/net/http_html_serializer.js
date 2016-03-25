'use strict'

var fs = require('fs')
var path = require('path')

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
    var recordTypes = this.recordTypes
    var encodeRoute = this.encodeRoute
    var page = [ fragments.docType, fragments.viewport, stylesheet ]
    var key

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
      // TODO: render
    }

    else if (contextResponse instanceof Error)
      // If the error is type unspecified, show the index.
      if (contextResponse.isTypeUnspecified) {
        page.push(tag('title', message('Index', language)))
        page.push(tag('div', { 'class': 'index' },
          tag('div', { 'class': 'index-cell' }, (function () {
            return [
              tag('h4', tag('span', message('Type', language))),
              tag('ul', (function () {
                var items = []

                for (key in recordTypes)
                  items.push(tag('li', tag('a', {
                    href: prefix + encodeRoute(key, null, null, uriBase64)
                  }, escapeHtml(key))))

                return items.join('')
              }()))
            ].join('')
          }()))))

        response.statusCode = 200
      }

      else {
        page.push(tag('title', contextResponse.toString()))
        page.push(tag('div', { 'class': 'index' },
          tag('div', { 'class': 'index-cell' }, (function () {
            return [
              tag('h1', contextResponse.name),
              tag('p', contextResponse.message)
            ].join('')
          }()))))
      }

    contextResponse.payload = page.join('')

    return contextResponse
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

  if (typeof attr === 'object') {
    attributes = []
    for (key in attr) attributes.push(key + '="' + attr[key] + '"')
    attributes = ' ' + attributes.join(' ')
  }
  else content = attr

  return '<' + name + attributes + '>' + content + '</' + name + '>'
}
