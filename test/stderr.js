import chalk from 'chalk'
import util from 'util'


const newLine = '\n'


export function warn () { return helper.call(this, 'yellow', ...arguments) }
export function log () { return helper.call(this, 'green', ...arguments) }
export function info () { return helper.call(this, 'blue', ...arguments) }
export function debug () { return helper.call(this, 'cyan', ...arguments) }


export function error () {
  const formatLine = line => `  ${line.trim()}`

  for (let argument of arguments) {
    if (argument instanceof Error) {
      const output = argument.stack || argument.name
      const lines = output.split(newLine)
      const error = lines[0]
      const trace = lines.slice(1).map(formatLine)

      helper.call(this, 'red', error)
      if (trace.length) helper.call(this, 'gray', ...trace)

      continue
    }
    helper.call(this, 'red', argument)
  }
}


function helper (color, ...args) {
  const output = Array.from(args, argument =>
    typeof argument === 'object' ? util.inspect(argument, {
      depth: null
    }) : argument)

  const decorate = line => chalk.gray('- ') + chalk[color](line)

  if (this.comment) {
    for (let argument of output)
      argument.split(newLine).map(decorate).forEach(this.comment)
    return
  }

  process.stderr.write(chalk[color](output.join(newLine) + newLine))
}
