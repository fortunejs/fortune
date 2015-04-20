import requestListener from './request_listener'

/**
 * Dead simple Koa middleware that wraps around the request listener.
 *
 * @param {Object} app Fortune instance
 * @param {Object} [settings] requestListener settings
 * @return {Function}
 */
export default (app, settings) => function* (next) {
  const { req, res } = this
  yield requestListener.bind(app, settings, req, res)
  yield next
}
