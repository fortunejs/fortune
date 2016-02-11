'use strict'

const chalk = require('chalk')
const fortune = require('../../lib')
const assign = require('../../lib/common/assign')
const stderr = require('../stderr')
const fixtures = require('../fixtures')

const inParens = /\(([^\)]+)\)/
const change = fortune.change
const methods = fortune.methods


module.exports = () => {
  const store = fortune({
    user: {
      name: { type: String },
      camelCaseField: { type: String },
      birthday: { type: Date },
      picture: { type: Buffer },
      createdAt: { type: Date },
      lastModified: { type: Date },
      nicknames: { type: String, isArray: true },
      someDate: { type: Date },

      // Many to many
      friends: { link: 'user', inverse: 'friends', isArray: true },

      // Many to many, denormalized inverse
      enemies: { link: 'user', isArray: true },

      // One to one
      spouse: { link: 'user', inverse: 'spouse' },

      // Many to one
      ownedPets: { link: 'animal', inverse: 'owner', isArray: true }
    },
    animal: {
      name: { type: String },

      // Implementations may have problems with this reserved word.
      type: { type: String },

      favoriteFood: { type: String },

      birthday: { type: Date },
      createdAt: { type: Date },
      lastModified: { type: Date },
      picture: { type: Buffer },
      nicknames: { type: String, isArray: true },
      someDate: { type: Date },

      // One to many
      owner: { link: 'user', inverse: 'ownedPets' }
    },
    '☯': {}
  }, {
    transforms: {
      user: [
        function input (context, record, update) {
          const method = context.request.method

          if (method === methods.create)
            return assign({}, record, {
              createdAt: new Date()
            })

          if (method === methods.update) {
            if (!('replace' in update)) update.replace = {}
            update.replace.lastModified = new Date()
            return update
          }

          // For the `delete` method, return value doesn't matter.
          return null
        },
        function output (context, record) {
          record.timestamp = Date.now()
          return Promise.resolve(record)
        }
      ],
      animal: [
        function input (context, record, update) {
          const method = context.request.method

          if (method === methods.create)
            return assign({}, record, {
              createdAt: new Date()
            })

          if (method === methods.update) {
            if (!('replace' in update)) update.replace = {}
            update.replace.lastModified = new Date()
            return update
          }

          // For the `delete` method, return value doesn't matter.
          return null
        },
        function output (context, record) {
          record.virtualProperty = 123
          return record
        }
      ]
    }
  })

  store.on(change, data => {
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
