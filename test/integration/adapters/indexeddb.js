import testAdapter from '../../unit/adapter'
import indexeddbAdapter from '../../../lib/adapter/adapters/indexeddb'


testAdapter(indexeddbAdapter, {
  name: 'fortune_test'
})
