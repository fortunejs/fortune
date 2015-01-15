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

    writeResponse(body, context, request, response);

  }, function (error) {
    context.error = error;
    console.error(error.hasOwnProperty('stack') ? error.stack : error);

    // if an error code isn't already specified, assume it's a server error
    if (response.statusCode < 400) {
      response.statusCode = 500;
    }

    return new Promise(function (resolve, reject) {
      try {
        resolve(_this.serializer.showErrors.call(_this, context, request, response));
      } catch (error) {
        reject(error);
      }
    }).then(function (body) {
      writeResponse(body, context, request, response);
    }, function () {
      response.end();
    });

  });
}


function writeResponse (body, context, request, response) {
  response.setHeader('Content-Type', context.mediaType);
  response.setHeader('Content-Length', body.length);
  response.setHeader('X-Response-Time', (Date.now() - request.timestamp) + 'ms');
  response.write(body);

  return response.end();
}
