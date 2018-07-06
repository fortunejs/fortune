'use strict'

const chalk = require('chalk')
const fortune = require('../../lib')
const assign = require('../../lib/common/assign')
const stderr = require('../stderr')
const fixtures = require('../fixtures')

const inParens = /\(([^\)]+)\)/
const change = fortune.events.change
const methods = fortune.methods


module.exports = adapter => {
  const store = fortune({
    user: {
      name: { type: String },
      birthday: { type: Date },
      picture: { type: Buffer },
      createdAt: { type: Date },
      lastModifiedAt: { type: Date },
      nicknames: { type: String, isArray: true },

      // Many to many
      friends: { link: 'user', inverse: 'friends', isArray: true },

      // Many to many, denormalized inverse
      enemies: { link: 'user', isArray: true },

      // One to one
      spouse: { link: 'user', inverse: 'spouse' },

      // One to one
      likedAnimal: { link: 'animal', inverse: 'likedBy'},

      // Many to one
      ownedPets: { link: 'animal', inverse: 'owner', isArray: true }
    },
    animal: {
      name: { type: String },

      // Implementations may have problems with this reserved word.
      type: { type: String },

      isNeutered: { type: Boolean },

      birthday: { type: Date },
      createdAt: { type: Date },
      lastModifiedAt: { type: Date },
      nicknames: { type: String, isArray: true },
      picture: { type: Buffer },

      // One to one
      likedBy: { link: 'user', inverse: 'likedAnimal' },

      // One to many
      owner: { link: 'user', inverse: 'ownedPets' }
    },
    '☯': {}
  }, assign({
    hooks: {
      user: [
        function input (context, record, update) {
          switch (context.request.method) {
            case methods.create:
              record.createdAt = new Date()
              return record

            case methods.update:
              if (!('replace' in update)) update.replace = {}
              update.replace.lastModifiedAt = new Date()
              return update
          }
        },
        function output (context, record) {
          record.timestamp = Date.now()
          return Promise.resolve(record)
        }
      ],
      animal: [
        function input (context, record, update) {
          switch (context.request.method) {
            case methods.create:
              return assign({}, record, {
                createdAt: new Date()
              })

            case methods.update:
              if (!('replace' in update)) update.replace = {}
              update.replace.lastModifiedAt = new Date()
              return update
          }
        },
        function output (context, record) {
          record.virtualProperty = 123
          return record
        }
      ]
    }
  }, adapter ? { adapter } : null))

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
