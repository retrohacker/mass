const errors = require('restify-errors')
const neo = require('neo-async')
const sql = require('../../sql')

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ params: request.params }, 'got request')

  const { name } = request.params

  // First validate our payload
  if (!name) {
    return next(new errors.BadRequestError('expected name param'))
  }

  if ((typeof name) !== 'string') {
    return next(new errors.BadRequestError('expected name to be string'))
  }

  let result
  neo.waterfall([
    (cb) => {
      request.log.info({ name }, 'query')
      pool.query(sql.select.repository, [name], cb)
    },
    (res, cb) => {
      result = res.rows[0]
      cb()
    }
  ], err => {
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }
    if (!result) {
      return next(new errors.NotFoundError(`Repository ${name} does not exist`))
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(result)
    next()
  })
}
