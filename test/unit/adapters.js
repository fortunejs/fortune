import testAdapter from './adapter'
import * as adapters from '../../lib/adapter/adapters'


const options = {
  MongoDB: { url: 'mongodb://localhost:27017/test' }
}

for (let key of Object.keys(adapters))
  testAdapter(adapters[key], options[key])
