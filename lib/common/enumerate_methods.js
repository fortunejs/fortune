/**
 * Get a hash of a class's methods. This is not so straightforward
 * because class methods are not enumerable.
 *
 * @param {Class} cls
 * @return {Object}'
 */
export default function enumerateMethods (cls = class {}) {
  return Object.getOwnPropertyNames(cls.prototype)
    .reduce((methods, method) => {
      if (method !== 'constructor')
        methods[method] = cls.prototype[method];
      return methods;
    }, {});
}
