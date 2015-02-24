import chalk from 'chalk';
import util from 'util';

const newLine = '\n';

/*!
 * Internal functions to color warnings and errors.
 */
export default {

  warn () {
    console.warn(chalk.yellow(
      ...Array.from(arguments, inspectArgument)));
  },

  log () {
    console.warn(chalk.green(
      ...Array.from(arguments, inspectArgument)));
  },

  info () {
    console.warn(chalk.blue(
      ...Array.from(arguments, inspectArgument)));
  },

  debug () {
    console.warn(chalk.cyan(
      ...Array.from(arguments, inspectArgument)));
  },

  error () {
    // Assume that everything past the first line of an error
    // is a stack trace, and color it differently.
    console.error(...Array.from(arguments, arg =>
      arg.split(newLine).map((line, index) =>
        index > 0 ? chalk.dim(line) : chalk.red(line)
      ).join(newLine)));
  }

};


function inspectArgument (argument) {
  return typeof argument === 'object' ? util.inspect(argument, {
    depth: null
  }) : argument;
}
