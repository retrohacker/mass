const log = require('../../log')
const neo = require('neo-async')
const sql = require('../../sql')

module.exports = (pool) => (request, response, next) => {
  log.info({ query: request.query }, 'got request')
  const { name } = request.query

  let result = {}
  neo.waterfall([
    (cb) => {
      if (name) {
        return pool.query(sql.select.changesetsByName, [name], cb)
      }
      pool.query(sql.select.changesets, cb)
    },
    (res, cb) => {
      if (name) {
        result = { changesets: res.rows }
      } else {
        result = { changesets: res.rows.map(v => v.name) }
      }
      cb()
    }
  ], err => {
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(result)
    next()
  })
}
