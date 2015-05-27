/**
 * Define non-writable, non-configurable, enumerable properties given an
 * arbitrary number of objects.
 *
 * @param {...Object}
 */
export default function () {
  for (let argument of arguments)
    Object.defineProperties(this, Object.keys(argument)
      .reduce(setProperty.bind(argument), {}))
}


function setProperty (hash, key) {
  hash[key] = {
    value: this[key],
    enumerable: true
  }

  return hash
}