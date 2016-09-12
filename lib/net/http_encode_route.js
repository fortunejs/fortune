'use strict'

var buffer = Buffer.from || Buffer

var entityMap = {
  '+': '-',
  '/': '_',
  '=': ''
}


module.exports = function encodeRoute (type, ids, relatedField, isBase64) {
  var parts = [], route

  if (type) parts.push(encodeURIComponent(type))
  if (ids) parts.push(encodeURIComponent(Array.isArray(ids) ?
    ids.join(',') : ids))
  if (relatedField) parts.push(encodeURIComponent(relatedField))

  route = parts.join('/')

  return '/' + (isBase64 ? buffer(route).toString('base64')
    .replace(/[\+\/=]/g, function (x) { return entityMap[x] }) : route)
}
