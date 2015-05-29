import fs from 'fs'
import path from 'path'
import docchi from 'docchi'

const libPath = '../lib'

const docs = [
  { name: 'Fortune', path: 'index.js' },
  { name: 'Adapter', path: 'adapter/index.js' },
  { name: 'Serializer', path: 'serializer/index.js' },
  { name: 'Dispatcher', path: 'dispatcher/index.js' },
  { name: 'HTTP', path: 'net/http.js' }
]

for (let container of docs)
  container.docs = docchi.parse(fs.readFileSync(
    path.join(__dirname, libPath, container.path))).output()
