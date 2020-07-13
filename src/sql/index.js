const glob = require('glob')
const sql = {}
const debug = {}
const path = require('path')
const fs = require('fs')

const files = glob.sync(path.join(__dirname, '**', '*.sql'))
for (let i = 0; i < files.length; i++) {
  const file = files[i]
  const dir = path.dirname(path.relative(__dirname, file))
  let ref = sql
  let dref = debug
  dir.split(path.sep).forEach(v => {
    ref[v] = ref[v] || {}
    dref[v] = dref[v] || {}
    ref = ref[v]
    dref = dref[v]
  })
  const name = path.basename(file, '.sql')
  ref[name] = fs.readFileSync(file, 'utf8')
  dref[name] = true
}

module.exports = sql
