import requestListener from './request_listener'

/**
 * Dead simple Koa middleware that wraps around the request listener.
 *
 * @param {Object} app Fortune instance
 * @param {Object} [settings] requestListener settings
 */
export default (app, settings) => {
  return function * (next) {
    yield requestListener.bind(app, settings, this.req, this.res)
    yield next
  }
}
