import { comment } from 'tapdance'
import chalk from 'chalk'
import util from 'util'


const newLine = '\n'


export function warn () { return helper('yellow', ...arguments) }
export function log () { return helper('green', ...arguments) }
export function info () { return helper('blue', ...arguments) }
export function debug () { return helper('cyan', ...arguments) }


export function error () {
  const formatLine = line => '  ' + line.trim()

  for (let argument of arguments) {
    if (argument instanceof Error) {
      const output = argument.stack || argument.name
      const lines = output.split(newLine)
      const error = lines[0]
      const trace = lines.slice(1).map(formatLine).join(newLine)

      helper('red', error)
      if (trace.length) helper('gray', trace)

      continue
    }
    helper('red', argument)
  }
}


function helper (color, ...args) {
  const output = Array.from(args, argument =>
    typeof argument === 'object' ? util.inspect(argument, {
      depth: null
    }) : argument).join(' ')

  const decorate = line => chalk[color](line)

  output.split(newLine).map(decorate).forEach(comment)
}
