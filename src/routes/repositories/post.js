const log = require('../../log')
const sql = require('../../sql')
const neo = require('neo-async')
const crypto = require('crypto')

// A determinstic digest generator that works across languages
// If we just do JSON.stringify and digest that, the digest will depend on the
// platform's implementation of JSON.stringify, which we don't want.
const repoDigest = (parent, stakeholders) => {
  // This character should be safe since we are creating a digest of UUID
  // values and not user generated strings.
  let str = parent
  if (stakeholders.length > 0) {
    str += '|' + stakeholders.join('|')
  }
  return crypto.createHash('sha256').update(str).digest('hex')
}

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

  const { changeset } = request.body

  // First validate our payload
  if (changeset === undefined) {
    return invalid('changeset is a required field')
  }
  if ((typeof changeset) !== 'string') {
    return invalid('changeset must be a string')
  }

  log.info({ changeset }, 'creating repository')

  let digest
  neo.waterfall([
    (cb) => {
      // Ensure the repository doesn't already exist
      pool.query(sql.select.repository, [changeset], cb)
    },
    (resp, cb) => {
      if (resp.rows.length > 0) {
        const err = new Error('Repository already exists')
        err.invalid = true
        return cb(err)
      }
      return cb()
    },
    (cb) => {
      pool.query(sql.exists.changeset, [changeset], cb)
    },
    (resp, cb) => {
      if (resp.rows.length === 0) {
        const err = new Error('Changeset does not exist')
        err.invalid = true
        return cb(err)
      }
      return cb()
    },
    (cb) => {
      // This query grabs the latest changeset under a given name and the
      // latest changeset for each dependency in it's dependency tree.
      pool.query(sql.select.changesetDeps, [changeset], cb)
    },
    (res, cb) => {
      // Turn the snapshot of the dependency tree into an initial commit
      const changesets = res.rows.map(r => r.uuid)
      const digest = repoDigest('null', changesets)
      log.info({
        changesets,
        digest
      }, 'generating commit')
      pool.query(sql.insert.commit, [null, digest, changesets], cb)
    },
    (res, cb) => {
      digest = res.rows[0].digest
      // Create a repository pointing to the commit
      pool.query(sql.insert.repository, [changeset, digest], cb)
    }
  ], (err) => {
    if (err && err.invalid === true) {
      return invalid(err.message)
    }
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send({ name: changeset, head: digest })
    next()
  })
}
