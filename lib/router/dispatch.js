module.exports = dispatch;


/**
 * Response dispatching.
 *
 * @param {Function} fn
 * @param {Object} context
 * @param {Object} request
 * @param {Object} response
 */
function dispatch (fn, context, request, response) {
  var _this = this;

  context = context || {};

  return new Promise(function (resolve, reject) {

    try {
      resolve(fn.call(_this, context, request, response));
    } catch (error) {
      reject(error);
    }

  }).then(function (body) {

    response.write(body);
    response.end();

  }, function (error) {
    console.trace(error);

    if (response.statusCode < 400) {
      response.statusCode = 500;
    }

    response.write(error.toString());
    response.end();

  });
}
