var stringify = require('./stringify');


module.exports = function (context) {
  var object = {
    errors: []
  };

  if (!Array.isArray(context.error)) {
    context.error = [context.error];
  }

  context.error.forEach(function (error) {
    if (!(error instanceof Error)) {
      error = new Error(error);
    }
    object.errors.push({
      title: error.name,
      detail: error.message,
      stack: error.stack.split('\n')
    });
  });

  return stringify(object);
};
