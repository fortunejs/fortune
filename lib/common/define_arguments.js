/**
 * Define non-writable, non-configurable, enumerable properties on the first
 * object given an arbitrary number of objects.
 *
 * @param {...Object}
 * @return {Object}
 */
export default function defineArguments () {
  const target = arguments[0]

  for (let argument of Array.prototype.slice.call(arguments, 1))
    Object.defineProperties(target, Object.keys(argument)
      .reduce(setProperty.bind(argument), {}))

  return target
}


function setProperty (hash, key) {
  hash[key] = {
    value: this[key],
    enumerable: true
  }

  return hash
}
