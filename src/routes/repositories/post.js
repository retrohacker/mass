const sql = require('../../sql')
const hlb = require('../../hlb')
const neo = require('neo-async')
const genDigest = require('../../digest')

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ body: request.body }, 'got request')

  // Convienence wrapper for rejecting invalid payloads
  const invalid = (msg) => {
    const err = new Error(msg)
    err.statusCode = 400
    return next(err)
  }

  if (request.body === undefined) {
    return invalid('Expected JSON post body')
  }

  const { artifactName, changeset } = request.body

  // First validate our payload
  if (changeset === undefined) {
    return invalid('changeset is a required field')
  }
  if ((typeof changeset) !== 'string') {
    return invalid('changeset must be a string')
  }
  if (artifactName === undefined) {
    return invalid('artifactName is a required field')
  }
  if ((typeof artifactName) !== 'string') {
    return invalid('artifactName must be a string')
  }

  request.log.info({ artifactName, changeset }, 'creating repository')

  let digest
  let uuid
  let changesets
  neo.waterfall([
    (cb) => {
      // Ensure the repository doesn't already exist
      pool.query(sql.exists.repository, [changeset, artifactName], cb)
    },
    (resp, cb) => {
      if (resp.rows.length === 0) {
        return cb()
      }

      const duplicate = resp.rows[0]

      if (duplicate.name === changeset) {
        const err = new Error('Repository already exists')
        err.invalid = true
        return cb(err)
      } else {
        const err = new Error('That artifactName is already used')
        err.invalid = true
        return cb(err)
      }
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
      uuid = resp.rows[0].uuid
      return cb()
    },
    (cb) => {
      // This query grabs the latest changeset under a given name and the
      // latest changeset for each dependency in it's dependency tree.
      pool.query(sql.select.changesetDeps, [uuid], cb)
    },
    (res, cb) => {
      // Turn the snapshot of the dependency tree into an initial commit
      changesets = res.rows
      const uuids = changesets.map(v => v.uuid)
      const digest = genDigest('null', uuids)
      request.log.info({
        changesets: uuids,
        digest
      }, 'generating commit')
      pool.query(sql.insert.commit, [null, digest, uuids], cb)
    },
    (res, cb) => {
      digest = res.rows[0].digest
      // Create a repository pointing to the commit
      pool.query(sql.insert.repository, [changeset, artifactName, digest], cb)
    }
  ], (err) => {
    if (err && err.invalid === true) {
      return invalid(err.message)
    }
    if (err) {
      request.log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send({ name: changeset, head: digest })
    next()

    // Build the image for the commit we just generated outside the
    // request/response lifecycle
    hlb.build({
      artifactName,
      changesets
    }, () => {})
  })
}
