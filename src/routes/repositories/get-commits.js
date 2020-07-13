const sql = require('../../sql')
const isDigest = /^[0-9a-zA-Z]{64}$/

// Given a set of commits including a parent and digest field, return them
// in the proper order
function sortCommits (rows) {
  const result = []

  // Create an index of the "digest" and "parent" fields mapping them to the row
  // they belong to
  const parents = new Map()
  const digests = new Map()

  // Populate the index
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const { digest, parent } = row
    digests.set(digest, row)
    parents.set(parent, row)
  }

  // Next find the digest that isn't the parent of any other row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const { digest } = row
    if (parents.has(digest)) {
      continue
    }
    result.push(row)
    break
  }

  // Now finish filling out the array by following the chain of parents
  while (result.length < rows.length) {
    // Take the digest of the previous commit and find the row that has it
    // listed as it's parent, pushing that digest to the results array.
    const next = digests.get(result[result.length - 1].parent)
    if (!next) {
      break
    }
    result.push(next)
  }

  return result
}

module.exports = (pool) => (request, response, next) => {
  request.log.info({ query: request.query, params: request.params }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  const { name } = request.params
  const { from } = request.query

  // First validate our payload
  if (!name) {
    return invalid('expected name param')
  }

  if ((typeof name) !== 'string') {
    return invalid('expected name to be string')
  }

  // Optionally support a "from" digest for pagination. The first request to
  // this endpoint should include only a name. If there are > 100 commits, we
  // will return the first 100. The final element in the returned array will
  // have a parent digest, follow back up with that digest as "from" to get the
  // next batch of 100 commits
  if (from && (typeof from) !== 'string') {
    return invalid('expected from to be string')
  }

  if (from && !isDigest.test(from)) {
    return invalid('expected from to be sha256 digest')
  }

  request.log.info({ name, from }, 'query')
  // Given the name of the repo, select the commit pointed to by the repo's
  // HEAD and up to 99 additional parent commits
  let query = sql.select['repo-commits']
  let args = [name]
  // If we were given a from commit in the request, query that commit and
  // up to 99 additional parent commits
  if (from) {
    query = sql.select['repo-commits-by-parent']
    args = [from]
  }
  pool.query(query, args, (err, res) => {
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
    response.send({
      commits: sortCommits(res.rows)
    })
    next()
  })
}
