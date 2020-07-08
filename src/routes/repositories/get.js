const log = require('../../log')
const sql = require('../../sql')

module.exports = (pool) => (request, response, next) => {
  log.info('got request')
  pool.query(sql.select.repositories, (err, resp) => {
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(200)
    response.send({
      repositories: resp.rows.map(v => v.name)
    })
    next()
  })
}
