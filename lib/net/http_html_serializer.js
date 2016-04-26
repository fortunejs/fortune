'use strict'

var fs = require('fs')
var path = require('path')

var map = require('../common/array/map')
var filter = require('../common/array/filter')

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

var selfClosing = {
  input: true,
  meta: true
}

var stylesheet = tag('style',
  fs.readFileSync(path.join(__dirname, 'page.css'))
    .toString().replace(/(\r\n|\n|\r)/gm, ''))

var fragments = {
  docType: '<!DOCTYPE html>',
  viewport: tag('meta', {
    name: 'viewport',
    content: 'width=device-width,initial-scale=1'
  })
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
    var bufferEncoding = this.options.bufferEncoding || 'base64'
    var payload = contextResponse.payload
    var method = request.meta.method
    var language = request.meta.language
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
    var key, parts, breadcrumbs, groups, metaType, createForm, includeType

    // Redirect update/delete method to referer if possible.
    if ((method === methods.delete || method === methods.update) &&
      !(contextResponse instanceof Error)) {
      delete contextResponse.payload
      response.statusCode = 303
      response.setHeader('Location', 'referer' in request.headers ?
        request.headers['referer'] :
        (prefix + encodeRoute(type, null, null, uriBase64)))
      return contextResponse
    }

    // Set the charset to UTF-8.
    response.setHeader('Content-Type',
      HtmlSerializer.mediaType + '; charset=utf-8')

    if (payload != null) {
      metaType = request.meta.type
      createForm = tag('form', {
        method: 'POST',
        'class': 'modal',
        enctype: 'multipart/form-data',
        action: prefix + encodeRoute(metaType, null, null, uriBase64)
      }, [
        tag('label', {
          'class': 'close',
          'for': 'create-toggle'
        }, '&#x2715;'),
        tag('div', {
          'class': 'container'
        }, (function () {
          var inputs = [
            tag('input', {
              type: 'submit',
              'class': 'hidden',
              id: 'create-record'
            }),
            tag('h2', [
              message('Create', language),
              ' &ldquo;',
              escapeHtml(metaType),
              '&rdquo;'
            ])
          ].concat(map(Object.keys(recordTypes[metaType]), function (key) {
            return renderInputGroup(metaType, key, {})
          }), tag('label', {
            'class': 'button blue',
            'for': 'create-record'
          }, tag('span', {
            'class': 'icon'
          }, '&#xff0b;') + message('Create', language)))

          return inputs
        }()))
      ])

      parts = [ escapeHtml(type) ]
      groups = []

      if (ids) parts.push(escapeHtml(ids.join(', ')))
      if (relatedField) parts.push(escapeHtml(relatedField))
      page.push(tag('title', [ message('Index', language) ]
        .concat(parts).join(' &rarr; ')))

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

      if ('include' in contextResponse.payload)
        for (includeType in contextResponse.payload.include)
          groups.push(renderGroup(includeType,
            contextResponse.payload.include[includeType], true))

      page.push(renderSidebar(type), tag('main', [
        tag('header', [
          tag('input', {
            type: 'checkbox',
            'class': 'hidden',
            id: 'create-toggle'
          }),
          createForm,
          tag('label', {
            'class': 'button blue',
            'for': 'create-toggle'
          }, tag('span', {
            'class': 'icon'
          }, '&#xff0b;') + message('Create', language)),
          breadcrumbs
        ]),
        groups
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

              return items
            }()))
          ])))

        response.statusCode = 200
      }

      else {
        page.push(tag('title', contextResponse.toString()))
        page.push(tag('div', { 'class': 'index' },
          tag('div', { 'class': 'index-cell' }, [
            tag('h1', contextResponse.name),
            tag('p', escapeHtml(contextResponse.message))
          ])))
      }

    contextResponse.payload = page.join('')

    return contextResponse

    function castToString (value, type) {
      if (value == null) return ''

      if (type === Date)
        return value.toJSON()
          .replace('T00:00:00.000Z', '')
      if (type === Buffer)
        return value.toString(bufferEncoding)
      if (type === Object || type === Array)
        return JSON.stringify(value)
      if (type === String)
        return escapeHtml(value)

      return value.toString()
    }

    function placeholder (type) {
      if (typeof type === 'string') return type + ' ID'
      if (type === String) return 'String'
      if (type === Number) return 'Number'
      if (type === Buffer)
        return 'Buffer (' + bufferEncoding + ')'
      if (type === Array) return 'Array'
      if (type === Object) return 'Object'
      if (type === Boolean) return 'Boolean'
      if (type === Date) return 'Date'
      return 'Unknown type'
    }

    function renderSidebar (type) {
      var include = map(
        filter(request.meta.include || [], function (path) {
          return path[0] !== ''
        }).concat(Array.apply(null, Array(3))),
        function (path) {
          return tag('input', {
            name: 'include',
            value: path ? (typeof path[path.length - 1] === 'object' ?
              path.slice(0, -1).join('.') + ',' +
              escapeHtml(JSON.stringify(path[path.length - 1])) :
              path.join('.')) : '',
            placeholder: message('IncludePath', language)
          })
        })

      var fields = map(
        Object.keys(request.meta.options.fields || {})
          .concat(Array.apply(null, Array(3))),
        function (field) {
          return tag('input', {
            name: 'fields',
            value: field || '',
            placeholder: message('Field', language)
          })
        })

      var match = map(
        Object.keys(recordTypes[type]),
        function (field) {
          var definition = recordTypes[type][field]

          return [
            tag('h3', field),
            tag('input', {
              name: 'match.' + field,
              value: (request.meta.options.match && castToString(
                request.meta.options.match[field], definition[typeKey])) || '',
              placeholder: placeholder(
                definition[typeKey] || definition[linkKey])
            })
          ]
        })

      var sort = map(
        Object.keys(request.meta.options.sort || {})
          .concat(Array.apply(null, Array(3))),
        function (field) {
          return tag('input', {
            name: 'sort',
            value: field ? (request.meta.options.sort[field] === false ?
              '-' : '') + field : '',
            placeholder: message('Field', language)
          })
        })

      return [
        tag('input', {
          type: 'checkbox',
          'class': 'hidden',
          id: 'sidebar-toggle'
        }),
        tag('aside', [
          tag('label', {
            'for': 'sidebar-toggle'
          }, [
            tag('span', [
              tag('strong', '&rsaquo;'),
              tag('strong', '&lsaquo;')
            ]),
            tag('span', message('QueryOptions', language))
          ])
        ]),
        tag('form', {
          'class': 'sidebar'
        }, [
          tag('input', {
            'class': 'hidden',
            type: 'submit',
            id: 'query-submit'
          }),
          tag('h2', message('Include', language)),
          tag('div', {
            'class': 'input-group'
          }, include),
          tag('h2', message('Fields', language)),
          tag('div', {
            'class': 'input-group'
          }, fields),
          tag('h2', message('Sort', language)),
          tag('div', {
            'class': 'input-group'
          }, sort),
          tag('h2', message('Match', language)),
          tag('div', {
            'class': 'input-group'
          }, match),
          tag('h2', message('Pagination', language)),
          tag('div', {
            'class': 'input-group'
          }, [
            tag('h3', message('Offset', language)),
            tag('input', {
              name: 'offset',
              value: request.meta.options.offset || '',
              placeholder: message('Offset', language)
            }),
            tag('h3', message('Limit', language)),
            tag('input', {
              name: 'limit',
              value: request.meta.options.limit || '',
              placeholder: message('Limit', language)
            })
          ]),
          tag('label', {
            'class': 'button blue',
            'for': 'query-submit'
          }, tag('span', {
            'class': 'icon'
          }, '&sext;') + message('Query', language))
        ])
      ].join('')
    }

    function renderInputGroup (type, key, record) {
      var fieldType = recordTypes[type][key][typeKey]
      var fieldLink = recordTypes[type][key][linkKey]
      var fieldIsArray = recordTypes[type][key][isArrayKey]
      var fields = fieldIsArray ? map((record[key] || []).concat(
        Array.apply(null, Array(3))),
        function (value) {
          return castToString(value, fieldType)
        }) : [ castToString(record[key], fieldType) ]

      return [
        tag('label', key)
      ].concat(map(fields, function (value) {
        return tag('input', {
          name: key,
          value: value,
          placeholder: placeholder(fieldType || fieldLink)
        })
      }))
    }

    function renderGroup (type, records, included) {
      var empty = tag('span', { 'class': 'empty' }, '&mdash;')
      var heading, keys, columns

      heading = [
        tag('span', { 'class': 'type' }, type),
        records.count && records.count > records.length ?
          tag('span', '(' + records.count + ')') : '',
        included ? tag('span',
          '(' + message('IncludedLabel', language) + ')') : ''
      ]

      keys = Object.keys(recordTypes[type])

      if ('fields' in request.meta.options && !included)
        keys = filter(keys, function (key) {
          return key in request.meta.options.fields
        })

      columns = [ primaryKey ].concat(keys, '&rlarr;')

      return tag('div', { 'class': 'group' }, [
        tag('h4', heading),
        tag('div', { 'class': 'box' }, tag('table', [
          tag('tr', columns.map(function (key) {
            return tag('th', key in recordTypes[type] ? escapeHtml(key) : key)
          }))
        ].concat(records.length ? map(records, function (record) {
          return tag('tr', columns.map(function (key, index) {
            var fieldType = key in recordTypes[type] &&
              recordTypes[type][key][typeKey]
            var fieldIsArray = key in recordTypes[type] &&
              recordTypes[type][key][isArrayKey]
            var fieldLink = key in recordTypes[type] &&
              recordTypes[type][key][linkKey]
            var deleteId = new Buffer([
              'delete', type, record[primaryKey]
            ].join('')).toString('hex')
            var toggleId = new Buffer([
              'toggle', type, record[primaryKey]
            ].join('')).toString('hex')
            var updateId = new Buffer([
              'update', type, record[primaryKey]
            ].join('')).toString('hex')
            var value, updateForm

            if (index < columns.length - 1) {
              value = fieldIsArray ? record[key] : [ record[key] ]

              if (!value.length) value = empty
              else value = map(value, function (x) {
                if (x === null || x === void 0) return empty

                if (fieldType === Buffer) x = x.toString(bufferEncoding)
                else if (fieldType === Date) x = tag('time', x.toJSON()
                  // Abbreviate dates.
                  .replace('T00:00:00.000Z', ''))
                else if (fieldType === Object || fieldType === Array)
                  x = escapeHtml(JSON.stringify(x))
                else if (fieldType === Boolean)
                  x = tag('span', {
                    'class': 'boolean ' + x.toString()
                  }, x ? '&check;' : '&#x2717;') +
                  tag('label', message(x.toString().charAt(0).toUpperCase() +
                    x.toString().slice(1), language))
                else if (fieldType === Number)
                  x = tag('label', x.toString())
                else x = escapeHtml(x.toString())

                return tag('span', { 'class': 'value' }, x)
              }).join(', ')

              return tag('td',
                key === primaryKey || fieldLink ? tag('a', {
                  href: prefix + encodeRoute(type, record[primaryKey],
                    key !== primaryKey && key, uriBase64)
                }, value) : value)
            }

            updateForm = tag('div', {
              'class': 'modal'
            }, [
              tag('label', {
                'class': 'close',
                'for': toggleId
              }, '&#x2715;'),
              tag('div', {
                'class': 'container'
              }, (function () {
                var inputs = [
                  tag('h2', [
                    message('Update', language),
                    ' &ldquo;',
                    escapeHtml(record[primaryKey].toString()),
                    '&rdquo;'
                  ])
                ].concat(map(columns.slice(1, -1), function (key) {
                  return renderInputGroup(type, key, record)
                }), tag('label', {
                  'class': 'button blue',
                  'for': updateId
                }, tag('span', {
                  'class': 'icon'
                }, '&asymp;') + message('Update', language)))

                return inputs
              }()))
            ])

            return tag('td', [
              tag('form', {
                method: 'POST',
                enctype: 'multipart/form-data',
                action: prefix + encodeRoute(type,
                  record[primaryKey], null, uriBase64)
              }, [
                tag('input', {
                  type: 'hidden',
                  name: 'method',
                  value: 'update'
                }),
                tag('input', {
                  type: 'submit',
                  'class': 'hidden',
                  id: updateId
                }),
                tag('input', {
                  type: 'checkbox',
                  'class': 'hidden',
                  id: toggleId
                }),
                updateForm,
                tag('label', {
                  'class': 'button blue',
                  'for': toggleId
                }, tag('span', {
                  'class': 'icon'
                }, '&asymp;') + message('Update', language))
              ]),
              tag('form', {
                method: 'POST',
                action: prefix + encodeRoute(type,
                  record[primaryKey], null, uriBase64)
              }, [
                tag('input', {
                  type: 'hidden',
                  name: 'method',
                  value: 'delete'
                }),
                tag('input', {
                  type: 'submit',
                  'class': 'hidden',
                  id: deleteId
                }),
                tag('label', {
                  'class': 'button red',
                  'for': deleteId
                }, tag('span', {
                  'class': 'icon'
                }, '&#x2715;') + message('Delete', language))
              ])
            ])
          }))
        }) : tag('tr',
          tag('td', {
            'class': 'empty',
            colspan: columns.length
          }, message('NoResults', language))))))
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
    attributes = [ '' ]
    for (key in attr) attributes.push(key + '="' + attr[key] + '"')
    attributes = attributes.join(' ')
  }
  else content = attr

  if (typeof content === 'function') content = content()

  return '<' + name + attributes + '>' + (!(name in selfClosing) ?
    (Array.isArray(content) ? flatten(content).join('') : content || '') +
    '</' + name + '>' : '')
}


function flatten (array) {
  var i, j, accumulator = []

  for (i = 0, j = array.length; i < j; i++)
    if (Array.isArray(array[i]))
      Array.prototype.push.apply(accumulator, flatten(array[i]))
    else accumulator.push(array[i])

  return accumulator
}
