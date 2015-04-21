import Fortune from '../../lib'
import * as stderr from '../../lib/common/stderr'


const defaults = {}


export default options =>

  new Fortune(Object.assign({}, defaults, options))

  .defineModel('user', {
    name: { type: String },
    age: { type: Number, min: 0, max: 100 },
    friends: { link: 'user', inverse: 'friends' },
    pets: { link: 'animal', isArray: true, inverse: 'owner' }
  })

  .transformOutput((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  .defineModel('animal', {
    name: { type: String },
    owner: { link: 'user', inverse: 'pets' }
  })

  .transformOutput((context, record) => {
    record.ageOfPet = 123
    return record
  })

  .initialize()

  .then(app => {
    app.dispatcher.on('change', function () {
      if (!process.env.REPORTER)
        stderr.info('Change', ...arguments)
    })

    return app
  })
