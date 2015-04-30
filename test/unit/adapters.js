import runAdapter from './run_adapter'
import Adapter from '../../lib/adapter'
import * as adapters from '../../lib/adapter/adapters'


const options = {
  MongoDB: { url: 'mongodb://localhost:27017/test' }
}

Object.keys(adapters).forEach(key => {
  let A = adapters[key]

  // Check if it's a class or a dependency injection function.
  try { A = A(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  runAdapter(A, options[key])
})
