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
  server.use(restify.plugins.requestLogger())
  server.use((request, response, next) => {
    request.log.info({
      route: request.getRoute().spec,
      href: request.href()
    }, 'received request')
    next()
  })
  server.on('after', (request, response) => {
    request.log.info({
      route: request.getRoute().spec,
      href: request.href()
    }, 'handled request')
  })

  let pool
  neo.waterfall([
    (cb) => db(config, cb),
    (p, cb) => {
      pool = p
      const c = { pool, log }
      // load routes
      server.post('/changesets', require('./routes/changesets/post.js')(c))
      server.get('/changesets/:uuid', require('./routes/changesets/get-uuid.js')(c))
      server.get('/changesets', require('./routes/changesets/get.js')(c))
      server.post('/repositories', require('./routes/repositories/post.js')(c))
      server.get('/repositories', require('./routes/repositories/get.js')(c))
      server.get('/repositories/:name', require('./routes/repositories/get-name.js')(c))
      server.get('/repositories/:name/commits', require('./routes/repositories/get-commits.js')(c))
      server.get('/repositories/:name/commits/:commit', require('./routes/repositories/get-commits-commit.js')(c))
      server.get('/campaigns/:uuid', require('./routes/campaigns/get-uuid.js')(c))
      server.listen(...config.server.listen, cb)
      server.on('restifyError', (request, response, err, next) => {
        request.log.error({ err })
        next()
      })
    }
  ], function (e) {
    if (e) {
      return cb(e)
    }

    log.info({ config: config.server }, 'server up')

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
