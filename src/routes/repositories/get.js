const errors = require('restify-errors')
const sql = require('../../sql')

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info('got request')
  pool.query(sql.select.repositories, (err, resp) => {
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }
    response.header('content-type', 'application/json')
    response.status(200)
    response.send({
      repositories: resp.rows.map(v => v.name)
    })
    next()
  })
}
