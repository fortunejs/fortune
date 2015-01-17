module.exports = stringify;


function stringify (object) {
  return JSON.stringify(object, null, 2);
}
