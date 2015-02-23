import chalk from 'chalk';

const newLine = '\n';

/*!
 * Internal functions to color warnings and errors.
 */
export default {

  warn () {
    console.warn(chalk.yellow(...arguments));
  },

  debug () {
    console.warn(chalk.cyan(...arguments));
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
