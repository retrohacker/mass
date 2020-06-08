const db = require('./db')
const log = require('./log')
const restify = require('restify')
const neo = require('neo-async')

module.exports = function init (config, cb) {
  const server = restify.createServer({
    log
  })

  server.use(restify.plugins.bodyParser())

  let pool
  const result = {}
  result.close = done => {
    neo.parallel([
      (cb) => server.close(cb),
      (cb) => pool ? pool.end(cb) : cb()
    ], done)
  }
  neo.waterfall([
    (cb) => db(cb),
    (p, cb) => {
      pool = p
      log.info({ config: config.server }, 'server up')
      server.listen(...config.server.listen, cb)
    },
    (cb) => {
      // load routes
      server.post('/changesets', require('./routes/changesets/post.js')(pool))
      cb()
    }
  ], function (e) {
    cb(e, result)
  })
}

if (require.main === module) {
  module.exports(require('./config.js'), function (err) {
    log.error({ err })
    if (err) {
      throw err
    }
  })
}
