const sql = require('../../sql')
const neo = require('neo-async')
const campaign = require('../../campaign')

module.exports = ({ pool, log }) => (request, response, next) => {
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

  request.log.info({ image, name, stakeholders }, 'creating changeset')
  const result = {}
  neo.waterfall([
    (cb) => {
      // First we generate the changeset
      pool.query(sql.insert.changeset, [name, image, stakeholders], cb)
    },
    (res, cb) => {
      // Store the returned changeset UUID so we can send it back to the client
      // later
      result.uuid = res.rows[0].uuid
      cb()
    },
    (cb) => {
      // Get all of the repositories that have this changeset in their
      // dependency tree
      pool.query(sql.select.repositoriesByChangeset, [name], cb)
    },
    (repos, cb) => {
      // Send the list of pull requests we are opening back to the client
      result['pull-requests'] = repos.rows.map(v => v.name)

      request.log.info({ prs: result['pull-requests'] }, 'opening pull requests')

      // Generate pull requests against those repositories
      neo.each(
        result['pull-requests'],
        (repo, cb) => pool.query(sql.insert.pullrequest, [result.uuid, repo], cb),
        cb)
    }
  ], (err) => {
    if (err) {
      request.log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    // Kick off the change campaign
    campaign(pool, log)
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(result)
    next()
  })
}
