import runAdapter from './run_adapter'
import Adapter from '../../lib/adapter'
import * as adapters from '../../lib/adapter/adapters'


const options = {
  MongoDB: { url: 'mongodb://localhost:27017/test' }
}

Object.keys(adapters).forEach(key => {
  let adapter = adapters[key]

  // Check if it's a class or a dependency injection function.
  try { adapter = adapter(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  runAdapter(adapter, options[key])
})
