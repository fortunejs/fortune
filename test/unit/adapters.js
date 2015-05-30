import testAdapter from './adapter'
import * as adapters from '../../lib/adapter/adapters'


const options = {}

for (let key of Object.keys(adapters))
  testAdapter(adapters[key], options[key])
