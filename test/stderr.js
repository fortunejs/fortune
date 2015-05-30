import chalk from 'chalk'
import util from 'util'


const silent = process.env.REPORTER
const newLine = '\n'


export function warn () {
  if (!silent)
    write(chalk.yellow(...Array.from(arguments, inspect)))
}


export function log () {
  if (!silent)
    write(chalk.green(...Array.from(arguments, inspect)))
}


export function info () {
  if (!silent)
    write(chalk.blue(...Array.from(arguments, inspect)))
}


export function debug () {
  if (!silent)
    write(chalk.cyan(...Array.from(arguments, inspect)))
}


export function error () {
  if (!silent)
    write(...Array.from(arguments, argument => {
      if (argument instanceof Error)
        argument = argument.stack || argument.name

      if (typeof argument !== 'string')
        return chalk.red(inspect(argument))

      // Assume that everything past the first line of an error
      // is a stack trace, and color it differently.
      return argument.split(newLine).map((line, index) =>
        index > 0 ? chalk.gray(`  ${line.trim()}`) : chalk.red(line)
      ).join(newLine)
    }))
}


// Use the built-in `util.inspect` to pretty-print objects.
function inspect (argument) {
  return typeof argument === 'object' ? util.inspect(argument, {
    depth: null
  }) : argument
}


// Use `process.stderr.write`.
function write () {
  process.stderr.write([ ...arguments ].join(newLine) + newLine)
}
