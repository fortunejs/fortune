'use strict'

module.exports = function castToNumber (id) {
  // Stolen from jQuery source code:
  // https://api.jquery.com/jQuery.isNumeric/
  var float = Number.parseFloat(id)
  return id - float + 1 >= 0 ? float : id
}
