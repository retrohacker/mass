const pg = require('pg')
const neo = require('neo-async')
const config = require('./config')
const log = require('./log')
const glob = require('glob')
const fs = require('fs')
const path = require('path')

/* Establish a connection to an SQL database */
module.exports = function init (done) {
  log.info({ config: config.db }, 'connecting to db')
  // The first step is to create a pool of connections to the database
  const pool = module.exports.pool = new pg.Pool(config.db)

  // Next we load in all of the SQL queries we want to run against the database
  // when we initialize ourselves
  neo.waterfall([
    (next) => {
      // Grab all the sql files from the init folder
      glob(path.join(__dirname, 'sql/init/*.sql'), next)
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
      // execute the queries
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
      // all done
      log.info('initialized database')
      next()
    }
  ], (e) => done(e, pool))
}
