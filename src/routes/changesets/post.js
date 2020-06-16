const log = require('../../log')
const sql = require('../../sql')

module.exports = (pool) => (request, response, next) => {
  log.info({ body: request.body }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  if (request.body === undefined) {
    return invalid('Expected JSON post body')
  }

  const { name, image, stakeholders } = request.body

  // First validate our payload
  if (name === undefined) {
    return invalid('name is a required field')
  }
  if ((typeof name) !== 'string') {
    return invalid('name must be a string')
  }
  if (image === undefined) {
    return invalid('image is a required field')
  }
  if ((typeof image) !== 'string') {
    return invalid('image must be a string')
  }
  if (stakeholders === undefined) {
    return invalid('stakeholders is a required field')
  }
  if (!Array.isArray(stakeholders)) {
    return invalid('stakeholders must be an array')
  }
  if (!stakeholders.reduce((a, v) => a && (typeof (v) === 'string'), true)) {
    return invalid('stakeholders must be an array of strings')
  }

  log.info({ image, name, stakeholders }, 'creating changeset')
  pool.query(sql.insert.changeset, [name, image, stakeholders], (err, res) => {
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send({ uuid: res.rows[0].uuid })
    next()
  })
}
