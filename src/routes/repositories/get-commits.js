const log = require('../../log')
const sql = require('../../sql')

module.exports = (pool) => (request, response, next) => {
  log.info({ params: request.params }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  const { name } = request.params

  // First validate our payload
  if (!name) {
    return invalid('expected name param')
  }

  if ((typeof name) !== 'string') {
    return invalid('expected name to be string')
  }

  log.info({ name }, 'query')
  pool.query(sql.select['repo-commits'], [name], (err, res) => {
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    if (res.rows.length === 0) {
      const err = new Error('Not Found')
      err.statusCode = 404
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send({
      commits: res.rows.map(v => v.digest)
    })
    next()
  })
}
