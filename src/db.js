const pg = require('pg')
const neo = require('neo-async')
const config = require('./config')
const log = require('./log')
const glob = require('glob')
const fs = require('fs')

module.exports = {}

/* Establish a connection to an SQL database */
module.exports.init = function init (done) {
  // If we already have a pool created, short circuit
  if (pool) {
    log.info('attempting to re-instantiate db, short circuit')
    return done()
  }
  log.info({ config: config.db }, 'connecting to db')
  // The first step is to create a pool of connections to the database
  pool = module.exports.pool = new pg.Pool(config.db)

  // Next we load in all of the SQL queries we want to run against the database
  // when we initialize ourselves
  neo.waterfall([
    (next) => {
      // Grab all the sql files from the init folder
      glob('./init_sql/*.sql', next)
    },
    (files, next) => {
      log.info({ files }, 'fetched SQL queries to execute')
      // Get all the queries but preserve the filename
      neo.map(files, (file, cb) => {
        fs.readFile(file, 'utf8', (err, query) => {
          cb(err, { file, query })
        })
      }, next)
    },
    (queries, next) => {
      log.info('executing SQL queries')
      neo.each(queries, (q, cb) => {
        pool.query(q.query, (err, result) => {
          if (err) {
            log.error({ err, query: q.query, file: q.file }, 'failed to initalize database')
          }
          return cb(err)
        })
      }, next)
    },
    (_, next) => {
      log.info('initialized database')
      next()
    }
  ], done)
}

/* Expose our connection pool */
let pool = module.exports.pool

/* Teardown the connection pool */
module.exports.shutdown = function shutdown (done) {
  log.info('shutting down db')
  pool.end(done)
}
