const pg = require('pg')
const neo = require('neo-async')
const sql = require('./sql')

/* Establish a connection to an SQL database */
module.exports = function init (config, done) {
  config.log.info({ config: config.db }, 'connecting to db')
  // The first step is to create a pool of connections to the database
  const pool = module.exports.pool = new pg.Pool(config.db)

  // Next initialize the database (in case this is the first time we've run)
  const init = sql.init
  const files = Object.keys(init)
  config.log.info('initializing database')
  neo.each(files, (file, cb) => {
    pool.query(init[file], (err, result) => {
      if (err) {
        config.log.error({ err, file, query: init[file] }, 'failed to initalize database')
      }
      return cb(err)
    })
  }, (err) => {
    if (!err) {
      config.log.info('Finished initializing the database')
    }
    done(err, pool)
  })
}
