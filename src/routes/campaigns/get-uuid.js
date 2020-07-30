const errors = require('restify-errors')
const sql = require('../../sql')
const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ params: request.params }, 'got request')

  const { uuid } = request.params

  // First validate our payload
  if (!isUUID.test(uuid)) {
    return next(new errors.BadRequestError('expected valid v4 uuid string'))
  }

  pool.query(sql.select.campaign, [uuid], (err, res) => {
    // If we got an error back from the database, generate a 500 and abort the
    // request.
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }

    response.header('content-type', 'application/json')
    response.status(201)
    response.send({ 'pull-requests': res.rows })
    next()
  })
}
