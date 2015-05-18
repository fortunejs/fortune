/**
 * Define non-writable, non-configurable, enumerable properties given an
 * arbitrary number of objects.
 *
 * @param {...Object}
 */
export default function () {
  Array.prototype.forEach.call(arguments, argument => {
    Object.defineProperties(this, Object.keys(argument)
      .reduce((property, key) => {
        property[key] = {
          value: argument[key],
          enumerable: true
        }
        return property
      }, {}))
  })
}
