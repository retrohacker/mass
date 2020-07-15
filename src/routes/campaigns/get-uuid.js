const sql = require('../../sql')
const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ params: request.params }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  const { uuid } = request.params

  // First validate our payload
  if (!isUUID.test(uuid)) {
    return invalid('expected valid v4 uuid string')
  }

  pool.query(sql.select.campaign, [uuid], (err, res) => {
    // If we got an error back from the database, generate a 500 and abort the
    // request.
    if (err) {
      request.log.error({ err })
      err.statusCode = 500
      return next(err)
    }

    response.header('content-type', 'application/json')
    response.status(201)
    response.send({ 'pull-requests': res.rows })
    next()
  })
}
