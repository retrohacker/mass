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

  request.log.info({ uuid }, 'query')
  pool.query(sql.select.changeset, [uuid], (err, res) => {
    // If we got an error back from the database that takes precedent over
    // generating a 404. If the request was a success and we didn't get any
    // rows back for our query, generate a 404.
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }

    if (!err && res.rows.length === 0) {
      return next(new errors.NotFoundError(`No changeset with uuid: ${uuid}`))
    }

    // If we didn't run into an error, go ahead and pass the returned row
    // directly back to the client
    response.header('content-type', 'application/json')
    response.status(200)
    response.send(res.rows[0])
    return next()
  })
}
