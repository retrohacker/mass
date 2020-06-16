const log = require('../../log')
const neo = require('neo-async')
const sql = require('../../sql')
const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

module.exports = (pool) => (request, response, next) => {
  log.info({ params: request.params }, 'got request')

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

  let result
  neo.waterfall([
    (cb) => {
      log.info({ uuid }, 'query')
      pool.query(sql.select.changeset, [uuid], cb)
    },
    (res, cb) => {
      result = {
        name: res.rows[0].name,
        image: res.rows[0].image,
        stakeholders: []
      }
      res.rows.forEach(v => result.stakeholders.push(v.stakeholder))
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
