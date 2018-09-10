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
  var str, key, subtag

  if (!message.hasOwnProperty(language)) {
    subtag = language && language.match(/.+?(?=-)/)
    if (subtag) subtag = subtag[0]
    if (message.hasOwnProperty(subtag)) language = subtag
    else language = message.defaultLanguage
  }

  if (!message[language].hasOwnProperty(id))
    return message[language][genericMessage] || message.en[genericMessage]

  str = message[language][id]

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

// Copy function, useful for not writing over the main function.
Object.defineProperty(message, 'copy', {
  value: function () {
    /* eslint-disable no-new-func */
    var fn = new Function('return ' + message.toString())()
    /* eslint-enable no-new-func */
    var lang

    Object.defineProperty(fn, 'defaultLanguage', {
      value: 'en', writable: true
    })

    for (lang in message)
      fn[lang] = message[lang]

    return fn
  }
})
