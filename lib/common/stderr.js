import chalk from 'chalk'
import util from 'util'


const newLine = '\n'


function warn () {
  console.warn(chalk.yellow(...Array.from(arguments, inspect)))
}


function log () {
  console.warn(chalk.green(...Array.from(arguments, inspect)))
}


function info () {
  console.warn(chalk.blue(...Array.from(arguments, inspect)))
}


function debug () {
  console.warn(chalk.cyan(...Array.from(arguments, inspect)))
}


function error () {
  // Assume that everything past the first line of an error
  // is a stack trace, and color it differently.
  console.error(...Array.from(arguments, arg =>
    arg.split(newLine).map((line, index) =>
      index > 0 ? chalk.dim(line) : chalk.red(line)
    ).join(newLine)))
}


function inspect (argument) {
  return typeof argument === 'object' ? util.inspect(argument, {
    depth: null
  }) : argument
}


//Internal functions to color warnings and errors.
export default { warn, log, info, debug, error }
