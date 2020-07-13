const sql = require('../../sql')
const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

module.exports = (pool) => (request, response, next) => {
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

  request.log.info({ uuid }, 'query')
  pool.query(sql.select.changeset, [uuid], (err, res) => {
    // If we got an error back from our query, we are going to pass it to the
    // client, but want to send it back as a 500
    if (err) {
      request.log.error({ err })
      err.statusCode = 500
    }
    // If we got an error back from the database that takes precedent over
    // generating a 404. If the request was a success and we didn't get any
    // rows back for our query, generate a 404.
    if (!err && res.rows.length === 0) {
      err = new Error(`No changeset with uuid: ${uuid}`)
      err.statusCode = 404
    }
    // If we got an error back from the database, or generated a 404, send that
    // back to the client and abort the request
    if (err) {
      return next(err)
    }
    // If we didn't run into an error, go ahead and pass the returned row
    // directly back to the client
    response.header('content-type', 'application/json')
    response.status(200)
    response.send(res.rows[0])
    next()
  })
}
