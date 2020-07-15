const sql = require('../../sql')
const isDigest = /^[0-9a-zA-Z]{64}$/

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ params: request.params }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  const { name, commit } = request.params

  // First validate our payload
  if (!name) {
    return invalid('expected name param')
  }

  if ((typeof name) !== 'string') {
    return invalid('expected name to be string')
  }

  if (!commit) {
    return invalid('expected commit param')
  }

  if ((typeof commit) !== 'string') {
    return invalid('expected commit to be string')
  }

  if (!isDigest.test(commit)) {
    return invalid('expected commit to be sha256 string')
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
    response.send(res.rows[0])
    next()
  })
}
