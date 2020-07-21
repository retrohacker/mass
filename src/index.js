const db = require('./db')
const restify = require('restify')
const neo = require('neo-async')
const pino = require('pino')

module.exports = function init (conf, cb) {
  const config = JSON.parse(JSON.stringify(conf))
  const log = config.log = pino(config.log)
  const server = restify.createServer({ log: config.log })

  server.use(restify.plugins.bodyParser())
  server.use(restify.plugins.queryParser({
    mapParams: false
  }))

  let pool
  neo.waterfall([
    (cb) => db(config, cb),
    (p, cb) => {
      pool = p
      log.info({ config: config.server }, 'server up')
      server.listen(...config.server.listen, cb)
    },
    (cb) => {
      const config = { pool, log }
      // load routes
      server.post('/changesets', require('./routes/changesets/post.js')(config))
      server.get('/changesets/:uuid', require('./routes/changesets/get-uuid.js')(config))
      server.get('/changesets', require('./routes/changesets/get.js')(config))
      server.post('/repositories', require('./routes/repositories/post.js')(config))
      server.get('/repositories', require('./routes/repositories/get.js')(config))
      server.get('/repositories/:name', require('./routes/repositories/get-name.js')(config))
      server.get('/repositories/:name/commits', require('./routes/repositories/get-commits.js')(config))
      server.get('/repositories/:name/commits/:commit', require('./routes/repositories/get-commits-commit.js')(config))
      server.get('/campaigns/:uuid', require('./routes/campaigns/get-uuid.js')(config))
      cb()
    }
  ], function (e) {
    const result = { pool, log, server }
    result.close = done => {
      neo.parallel([
        (cb) => server.close(cb),
        (cb) => pool ? pool.end(cb) : cb()
      ], done)
    }
    cb(e, result)
  })
}

if (require.main === module) {
  const config = require('./config.js')
  module.exports(require('./config.js'), function (err) {
    pino(config.log).error({ err })
    if (err) {
      throw err
    }
  })
}
