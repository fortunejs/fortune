'use strict'

var languages = {
  en: require('./messages/en')
}

var key
for (key in languages)
  message[key] = languages[key]

module.exports = message


/**
 * Message function for i18n.
 *
 * @param {String} id
 * @param {String} language
 * @param {Object} [data]
 * @return {String}
 */
function message (id, language, data) {
  var genericMessage = 'GenericError'
  var self = this || message
  var str, key, subtag

  if (!self.hasOwnProperty(language)) {
    subtag = language && language.match(/.+?(?=-)/)
    if (subtag) subtag = subtag[0]
    if (self.hasOwnProperty(subtag)) language = subtag
    else language = self.defaultLanguage
  }

  str = self[language].hasOwnProperty(id) ?
    self[language][id] :
    self[language][genericMessage] || self.en[genericMessage]

  if (typeof str === 'string')
    for (key in data)
      str = str.replace('{' + key + '}', data[key])

  if (typeof str === 'function')
    str = str(data)

  return str
}

// Assign fallback language to "en".
Object.defineProperty(message, 'defaultLanguage', {
  value: 'en', writable: true
})
