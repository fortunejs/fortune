'use strict'

var chalk = require('chalk')
var util = require('util')
var map = require('../lib/common/array/map')

var newLine = '\n'

exports.warn = function (x, y, z) { return helper('yellow', x, y, z) }
exports.log = function (x, y, z) { return helper('green', x, y, z) }
exports.info = function (x, y, z) { return helper('blue', x, y, z) }
exports.debug = function (x, y, z) { return helper('cyan', x, y, z) }

exports.error = function () {
  var i, j, argument, output, lines, error, trace
  for (i = 0, j = arguments.length; i < j; i++) {
    argument = arguments[i]
    if (argument instanceof Error) {
      output = argument.stack || argument.name
      lines = output.split(newLine)
      error = lines[0]
      trace = map(lines.slice(1), formatLine).join(newLine)

      helper('red', error)
      if (trace.length) helper('gray', trace)

      continue
    }
    helper('red', argument)
  }
}

function formatLine (line) {
  return '  ' + line.trim()
}

function helper (color, x, y, z) {
  var output = map([x, y, z], function (argument) {
    return typeof argument === 'object' ?
      util.inspect(argument, { depth: null }) :
      argument
  }).join(' ')

  map(output.split(newLine), function (line) {
    if (line.trim())
      console.log('# ' + chalk[color](line)) // eslint-disable-line
  })
}
