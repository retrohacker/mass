const log = require('../../log')
const uuidParse = require('uuid-parse')
const neo = require('neo-async')
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

  let client, done, id, uuid
  let transaction = false
  let result
  neo.waterfall([
    (cb) => pool.connect(cb),
    (c, d, cb) => {
      client = c
      done = d
      log.info({ image, name }, 'beginning transaction')
      client.query('BEGIN', (err) => cb(err))
    },
    (cb) => {
      log.info({ image, name }, 'creating changeset')
      transaction = true
      client.query(sql.insert.changeset, [name, image], cb)
    },
    (res, cb) => {
      id = res.rows[0].id
      uuid = uuidParse.unparse(res.rows[0].uuid)
      result = { uuid }
      cb()
    },
    (cb) => {
      log.info({ image, name }, 'creating stakeholders')
      neo.each(stakeholders,
        (stakeholder, callback) => client.query(sql.insert.stakeholders, [id, stakeholder], callback)
        , cb)
    },
    (res, cb) => {
      log.info({ image, name, result }, 'commit transaction')
      client.query('COMMIT', err => cb(err))
    },
    (cb) => {
      log.info('transaction complete')
      transaction = false
      cb()
    }
  ], (err) => {
    if (err && transaction) {
      // Fire off the rollack but don't block responding to the client
      client.query('ROLLBACK', err => {
        if (err) {
          log.error({ err }, 'failed to rollback transaction')
        }
        done()
      })
    } else {
      // If we don't need to rollback, go ahead and return the pg client to the
      // pool
      done()
    }
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
