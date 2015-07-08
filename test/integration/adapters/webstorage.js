import testAdapter from '../../unit/adapter'
import webStorageAdapter from '../../../lib/adapter/adapters/webstorage'


testAdapter(webStorageAdapter, {
  prefix: 'fortune_test'
})
