import Fortune from '../../lib'
import * as stderr from '../../lib/common/stderr'


const defaults = {}


export default options => {

  const app = new Fortune(Object.assign(defaults, options))

  app.model('user', {
    name: { type: String },
    age: { type: Number, min: 0, max: 100 },
    friends: { link: 'user', inverse: 'friends' },
    pets: { link: 'animal', isArray: true, inverse: 'owner' }

  }).after((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  app.model('animal', {
    name: { type: String },
    owner: { link: 'user', inverse: 'pets' }

  }).after((context, record) => {
    record.ageOfPet = 123
    return record
  })

  app.dispatcher.on('change', function () {
    if (!process.env.REPORTER)
      stderr.info('Change', ...arguments)
  })

  return app.initialize()

}
