'use strict'

const chalk = require('chalk')
const fortune = require('../../lib')
const stderr = require('../stderr')
const fixtures = require('../fixtures')

const inParens = /\(([^\)]+)\)/
const change = fortune.change
const methods = fortune.methods


module.exports = options => {
  const store = fortune(options)

  .defineType('user', {
    name: { type: String },
    camelCaseField: { type: String },
    birthday: { type: Date },
    picture: { type: Buffer },
    createdAt: { type: Date },
    lastModified: { type: Date },
    nicknames: { type: String, isArray: true },

    // Many to many
    friends: { link: 'user', inverse: 'friends', isArray: true },

    // Many to many, denormalized inverse
    enemies: { link: 'user', isArray: true },

    // One to one
    spouse: { link: 'user', inverse: 'spouse' },

    // Many to one
    ownedPets: { link: 'animal', inverse: 'owner', isArray: true }
  })

  .transformInput((context, record, update) => {
    const method = context.request.method

    if (method === methods.create)
      return Object.assign({}, record, {
        createdAt: new Date()
      })

    if (method === methods.update) {
      if (!('replace' in update)) update.replace = {}
      update.replace.lastModified = new Date()
      return update
    }

    // For the `delete` method, return value doesn't matter.
    return null
  })

  .transformOutput((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  .defineType('animal', {
    name: { type: String },

    // Implementations may have problems with this reserved word.
    type: { type: String },

    favoriteFood: { type: String },

    birthday: { type: Date },
    createdAt: { type: Date },
    lastModified: { type: Date },
    picture: { type: Buffer },
    nicknames: { type: String, isArray: true },

    // One to many
    owner: { link: 'user', inverse: 'ownedPets' }
  })

  .transformInput((context, record, update) => {
    const method = context.request.method

    if (method === methods.create)
      return Object.assign({}, record, {
        createdAt: new Date()
      })

    if (method === methods.update) {
      if (!('replace' in update)) update.replace = {}
      update.replace.lastModified = new Date()
      return update
    }

    // For the `delete` method, return value doesn't matter.
    return null
  })

  .transformOutput((context, record) => {
    record.virtualProperty = 123
    return record
  })

  .defineType('☯', {})

  store.on(change, data => {
    for (let symbol of Object.getOwnPropertySymbols(data))
      assignDescription(data, symbol)

    stderr.info(chalk.bold('Change event:'), data)
  })

  return store.connect()

  // Delete all previous records.
  .then(() => Promise.all(Object.keys(fixtures).map(type =>
    store.adapter.delete(type)
  )))

  // Create fixtures.
  .then(() => Promise.all(Object.keys(fixtures).map(type =>
    store.adapter.create(type, fixtures[type])
  )))

  .then(() => store)

  .catch(error => {
    store.disconnect()
    throw error
  })
}


function assignDescription (object, symbol) {
  const description = (symbol.toString().match(inParens) || [])[1]
  if (description) object[description] = object[symbol]
}
