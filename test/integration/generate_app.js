import chalk from 'chalk'
import fortune from '../../lib'
import * as stderr from '../stderr'


const defaults = {}
const inParens = /\(([^\)]+)\)/


export default options =>

  fortune.create(Object.assign({}, defaults, options))

  .defineType('user', {
    name: { type: String },
    age: { type: Number, min: 0, max: 100 },
    friends: { link: 'user', inverse: 'friends' },
    pets: { link: 'animal', isArray: true, inverse: 'owner' }
  })

  .transformOutput((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  .defineType('animal', {
    name: { type: String },
    owner: { link: 'user', inverse: 'pets' }
  })

  .transformOutput((context, record) => {
    record.ageOfPet = 123
    return record
  })

  .initialize()

  .then(app => {
    const { events } = app.dispatcher

    app.dispatcher.on(events.change, data => {
      if (!process.env.REPORTER) {
        for (let type in data)
          Object.getOwnPropertySymbols(data[type])
          .forEach(assignDescription.bind(null, data[type]))

        stderr.info(chalk.bold('Change:'), data)
      }
    })

    return app
  })


function assignDescription (object, symbol) {
  const description = (symbol.toString().match(inParens) || [])[1]
  if (description) object[description] = object[symbol]
}
