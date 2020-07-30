const errors = require('restify-errors')
const sql = require('../../sql')
const isDigest = /^[0-9a-zA-Z]{64}$/

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ params: request.params }, 'got request')

  const { name, commit } = request.params

  // First validate our payload
  if (!name) {
    return next(new errors.BadRequestError('expected name param'))
  }

  if ((typeof name) !== 'string') {
    return next(new errors.BadRequestError('expected name to be string'))
  }

  if (!commit) {
    return next(new errors.BadRequestError('expected commit param'))
  }

  if ((typeof commit) !== 'string') {
    return next(new errors.BadRequestError('expected commit to be string'))
  }

  if (!isDigest.test(commit)) {
    return next(new errors.BadRequestError('expected commit to be sha256 string'))
  }

  request.log.info({ name, commit }, 'query')
  // Commits technically belong to a repo but our data model doesn't force that
  // relationship. Instead of trying to navigate the entire history from the
  // HEAD ref for a repo to find the commit, we simply grab a commit from the
  // table that matches the digest. These means you can query any commit from
  // any repostitory.
  pool.query(sql.select.commit, [commit], (err, res) => {
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }
    if (res.rows.length === 0) {
      return next(new errors.NotFoundError(`Commit ${commit} not found`))
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(res.rows[0])
    next()
  })
}
