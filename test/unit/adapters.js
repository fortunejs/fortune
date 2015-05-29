import adapterTest from './adapter'
import Adapter from '../../lib/adapter'
import * as adapters from '../../lib/adapter/adapters'


const options = {
  MongoDB: { url: 'mongodb://localhost:27017/test' }
}

for (let key of Object.keys(adapters)) {
  let adapter = adapters[key]

  // Check if it's a class or a dependency injection function.
  try { adapter = adapter(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  adapterTest(adapter, options[key])
}
