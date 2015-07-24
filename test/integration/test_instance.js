import chalk from 'chalk'
import fortune from '../../lib'
import * as stderr from '../stderr'
import * as fixtures from '../fixtures'


const inParens = /\(([^\)]+)\)/
const { change } = fortune


export default options => {
  const store = fortune.create(options)

  .defineType('user', {
    name: { type: String },
    camelCaseField: { type: String },
    birthday: { type: Date },
    picture: { type: Buffer },

    // Many to many
    friends: { link: 'user', inverse: 'friends', isArray: true },

    // Many to many, denormalized inverse
    enemies: { link: 'user', isArray: true },

    // One to one
    spouse: { link: 'user', inverse: 'spouse' },

    // Many to one
    pets: { link: 'animal', inverse: 'owner', isArray: true }
  })

  .transformOutput((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  .defineType('animal', {
    name: { type: String },

    // Implementations may have problems with this reserved word.
    type: { type: String },

    birthday: { type: Date },
    picture: { type: Buffer },

    // One to many
    owner: { link: 'user', inverse: 'pets' }
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
