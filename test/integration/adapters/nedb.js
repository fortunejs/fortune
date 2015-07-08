import path from 'path'
import testAdapter from '../../unit/adapter'
import nedbAdapter from '../../../lib/adapter/adapters/nedb'


testAdapter(nedbAdapter, {
  user: {
    filename: path.join(__dirname, '../../../test.db')
  }
})
